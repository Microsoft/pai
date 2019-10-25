// MIT License
//
// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE

package algorithm

import (
	"fmt"
	"github.com/microsoft/hivedscheduler/pkg/api"
	"github.com/microsoft/hivedscheduler/pkg/common"
	"github.com/microsoft/hivedscheduler/pkg/internal"
	core "k8s.io/api/core/v1"
	"k8s.io/klog"
	"math"
	"sync"
)

// HivedAlgorithm implements an internal.SchedulerAlgorithm. It schedules pods using the algorithm of HiveD.
// Note that the topologyAwareScheduler used in this struct is not another implementation of SchedulerAlgorithm;
// that is a specific algorithm for pod placement, used in intra-VC scheduling and opportunistic pod scheduling.
type HivedAlgorithm struct {
	// scheduler in each VC
	vcSchedulers map[api.VirtualClusterName]intraVCScheduler
	// scheduler for opportunistic pods
	opportunisticSchedulers map[CellChain]*topologyAwareScheduler
	// ChainCellLists of physical cells of each cell chain
	fullCellList map[CellChain]ChainCellList
	// ChainCellLists of free physical cells of each cell chain (used in buddy alloc)
	freeCellList map[CellChain]ChainCellList
	// map each GPU type to all chains that contain this type
	chains map[string][]CellChain
	// all affinity groups that have been allocated cells
	allocatedAffinityGroups map[string]*AlgoAffinityGroup
	// all reserved physical cells (VC -> reservation ID -> cells)
	reservedCells map[api.VirtualClusterName]map[api.ReservationId]*PhysicalCell
	// lock
	algorithmLock sync.RWMutex
}

// NewHivedAlgorithm initializes a HivedAlgorithm from the config file
func NewHivedAlgorithm(sConfig *api.Config) *HivedAlgorithm {
	pcl, gpuNums, gpuTypeToChain, nonReservedVcl, reservedVcl, reservedPc := ParseConfig(sConfig)
	h := &HivedAlgorithm{
		vcSchedulers:            make(map[api.VirtualClusterName]intraVCScheduler),
		opportunisticSchedulers: map[CellChain]*topologyAwareScheduler{},
		fullCellList:            pcl,
		freeCellList:            make(map[CellChain]ChainCellList),
		chains:                  gpuTypeToChain,
		allocatedAffinityGroups: make(map[string]*AlgoAffinityGroup),
		reservedCells:           reservedPc,
	}
	for vc := range nonReservedVcl {
		h.vcSchedulers[vc] = newDefaultIntraVCScheduler(nonReservedVcl[vc], reservedVcl[vc], gpuNums)
	}
	for chain, ccl := range h.fullCellList {
		h.opportunisticSchedulers[chain] = NewTopologyAwareScheduler(ccl, gpuNums[chain], false)
	}
	h.validateInitialAssignment()
	h.initFreeCellList()
	h.initReservations()
	return h
}

func (h *HivedAlgorithm) AddNode(node *core.Node) {
	// TODO
}

func (h *HivedAlgorithm) UpdateNode(oldNode, newNode *core.Node) {
	// TODO
}

func (h *HivedAlgorithm) DeleteNode(node *core.Node) {
	// TODO
}

func (h *HivedAlgorithm) Schedule(pod *core.Pod, suggestedNodes []string) internal.PodScheduleResult {
	h.algorithmLock.Lock()
	defer h.algorithmLock.Unlock()

	klog.Infof("[%v]: Scheduling pod...", internal.Key(pod))
	s := internal.ExtractPodSchedulingSpec(pod)
	// gpu number -> a set of pods -> a set of GPUs of each pod
	groupPhysicalPlacement := map[int32][]CellList{}
	groupVirtualPlacement := map[int32][]CellList{}
	newGroup := true
	podIndex := int32(0)

	if group := h.allocatedAffinityGroups[s.AffinityGroup.Name]; group == nil {
		klog.Infof("Scheduling new affinity group %v", s.AffinityGroup.Name)
		groupPhysicalPlacement, groupVirtualPlacement = h.scheduleNewAffinityGroup(pod, s)
	} else {
		if int32(len(group.allocatedPods[s.GpuNumber])) >= group.totalPodNums[s.GpuNumber] {
			panic(internal.NewBadRequestError(fmt.Sprintf(
				"Requesting more pods than the configured number for %v GPUs (%v pods) in affinity group %v",
				s.GpuNumber, group.totalPodNums[s.GpuNumber], s.AffinityGroup.Name)))
		}
		klog.Infof("Pod from existing affinity group: %v", s.AffinityGroup.Name)
		groupPhysicalPlacement = group.physicalGpuPlacement
		groupVirtualPlacement = group.virtualGpuPlacement
		newGroup = false
		podIndex = int32(len(group.allocatedPods[s.GpuNumber]))
	}
	return generatePodScheduleResult(
		groupPhysicalPlacement, groupVirtualPlacement, s.GpuNumber, podIndex, newGroup, suggestedNodes, pod)
}

// TODO: reconfig; suggestedNodes (failure)
func (h *HivedAlgorithm) AddAllocatedPod(pod *core.Pod) {
	h.algorithmLock.Lock()
	defer h.algorithmLock.Unlock()

	klog.Infof("[%v]: adding allocated pod...", internal.Key(pod))
	s := internal.ExtractPodSchedulingSpec(pod)
	info := internal.ExtractPodBindInfo(pod)

	chain := CellChain(info.CellChain)
	hasVirtualPlacement := true
	if group := h.allocatedAffinityGroups[s.AffinityGroup.Name]; group == nil {
		newGroup := newAlgoAffinityGroup(s.AffinityGroup)
		for _, gms := range info.AffinityGroupBindInfo {
			gpuNumber := int32(len(gms.PodPlacements[0].PhysicalGpuIndices))
			newGroup.physicalGpuPlacement[gpuNumber] = make([]CellList, len(gms.PodPlacements))
			if hasVirtualPlacement {
				newGroup.virtualGpuPlacement[gpuNumber] = make([]CellList, len(gms.PodPlacements))
			}
			for podIndex := int32(0); podIndex < int32(len(gms.PodPlacements)); podIndex++ {
				newGroup.physicalGpuPlacement[gpuNumber][podIndex] = make(
					CellList, len(gms.PodPlacements[podIndex].PhysicalGpuIndices))
				if hasVirtualPlacement {
					newGroup.virtualGpuPlacement[gpuNumber][podIndex] = make(
						CellList, len(gms.PodPlacements[podIndex].PhysicalGpuIndices))
				}
				node := gms.PodPlacements[podIndex].PhysicalNode
				for gpuIndex := int32(0); gpuIndex < int32(
					len(gms.PodPlacements[podIndex].PhysicalGpuIndices)); gpuIndex++ {
					physicalGpuIndex := gms.PodPlacements[podIndex].PhysicalGpuIndices[gpuIndex]
					pGpu := h.findPhysicalGpu(chain, node, physicalGpuIndex)
					if pGpu == nil {
						panic(fmt.Sprintf("[%v]: physical GPU cell not found when adding pod: node %v, GPU index %v",
							internal.Key(pod), node, physicalGpuIndex))
					}
					newGroup.physicalGpuPlacement[gpuNumber][podIndex][gpuIndex] = pGpu

					var vGpu *VirtualCell
					if hasVirtualPlacement {
						virtualCellIndex := gms.PodPlacements[podIndex].VirtualCellIndices[gpuIndex]
						if virtualCellIndex >= 0 {
							vGpu = h.findVirtualGpu(s.VirtualCluster, chain, s.ReservationId, virtualCellIndex)
							if vGpu == nil {
								panic(fmt.Sprintf("[%v]: virtual GPU cell not found when adding pod: virtual cell index %v",
									internal.Key(pod), virtualCellIndex))
							}
							newGroup.virtualGpuPlacement[gpuNumber][podIndex][gpuIndex] = vGpu
						} else {
							newGroup.virtualGpuPlacement = nil
							hasVirtualPlacement = false
						}
					}
					h.confirmAllocatedGpu(pGpu, vGpu, CellPriority(s.Priority), newGroup)
				}
			}
		}
		h.allocatedAffinityGroups[s.AffinityGroup.Name] = newGroup
		klog.Infof("New affinity group created: %v", s.AffinityGroup.Name)
	}
	klog.Infof("[%v]: added to node %v, GPUs %v", internal.Key(pod), info.Node, info.GpuIsolation)
	h.allocatedAffinityGroups[s.AffinityGroup.Name].allocatedPods[s.GpuNumber] = append(
		h.allocatedAffinityGroups[s.AffinityGroup.Name].allocatedPods[s.GpuNumber], pod)
}

func (h *HivedAlgorithm) DeleteAllocatedPod(pod *core.Pod) {
	h.algorithmLock.Lock()
	defer h.algorithmLock.Unlock()

	klog.Infof("[%v]: deleting allocated pod...", internal.Key(pod))
	s := internal.ExtractPodSchedulingSpec(pod)

	if group := h.allocatedAffinityGroups[s.AffinityGroup.Name]; group == nil {
		panic(fmt.Sprintf(
			"[%v]: group %v not exists when deleting pod", internal.Key(pod), s.AffinityGroup.Name))
	} else {
		allocatedPods := group.allocatedPods[s.GpuNumber]
		idx := -1
		for i, p := range allocatedPods {
			if pod.UID == p.UID {
				idx = i
				break
			}
		}
		if idx == -1 {
			panic(fmt.Sprintf("[%v]: pod not exists in group %v", internal.Key(pod), s.AffinityGroup.Name))
		} else {
			numAllocatedPods := len(allocatedPods)
			allocatedPods[idx] = allocatedPods[numAllocatedPods-1]
			allocatedPods[numAllocatedPods-1] = nil
			group.allocatedPods[s.GpuNumber] = group.allocatedPods[s.GpuNumber][:numAllocatedPods-1]
		}
		allPodsDeleted := true
		for _, pods := range group.allocatedPods {
			if len(pods) != 0 {
				allPodsDeleted = false
				break
			}
		}
		if allPodsDeleted {
			for _, podPlacements := range group.physicalGpuPlacement {
				for _, podPlacement := range podPlacements {
					for _, gpu := range podPlacement {
						h.confirmReleasedGpu(gpu.(*PhysicalCell), group)
					}
				}
			}
			delete(h.allocatedAffinityGroups, s.AffinityGroup.Name)
			klog.Infof("Affinity group deleted: %v", s.AffinityGroup.Name)
		}
	}
}

// validateInitialAssignment makes sure that the initial cell assignments
// to all VCs can be fit into the configured physical cells.
func (h *HivedAlgorithm) validateInitialAssignment() {
	totalQuota := map[CellChain]map[CellLevel]int32{}
	for _, vcs := range h.vcSchedulers {
		for chain, ccl := range vcs.getNonReservedCellList() {
			if totalQuota[chain] == nil {
				totalQuota[chain] = map[CellLevel]int32{}
			}
			l := CellLevel(len(ccl))
			totalQuota[chain][l] += int32(len(ccl[l]))
		}
	}
	for chain, chainQuota := range totalQuota {
		ccl := h.fullCellList[chain]
		top := CellLevel(len(ccl))
		available := int32(len(ccl[top]))
		for l := top; l >= lowestLevel; l-- {
			left := available - chainQuota[l]
			if left < 0 {
				panic(fmt.Sprintf(
					"Insufficient physical cells at chain %v level %v: %v needed, %v available",
					chain, l, chainQuota[l], available))
			}
			if l > lowestLevel {
				available = left * int32(len(ccl[l][0].GetChildren()))
			}
		}
	}
}

// initFreeCellList initializes the free cell list (i.e., top level cells in each chain).
func (h *HivedAlgorithm) initFreeCellList() {
	for chain, ccl := range h.fullCellList {
		topLevel := CellLevel(len(ccl))
		h.freeCellList[chain] = NewChainCellList(topLevel - 1)
		h.freeCellList[chain][topLevel] = make(CellList, len(ccl[topLevel]))
		copy(h.freeCellList[chain][topLevel], ccl[topLevel])
	}
}

// initReservations creates static bindings for the reserved cells, and removes the
// reserved physical cells from the free cell list.
func (h *HivedAlgorithm) initReservations() {
	for vc, vcReservation := range h.reservedCells {
		for rid, physical := range vcReservation {
			h.removeCellFromFreeList(physical)
			virtualList := h.vcSchedulers[vc].getReservedCellList()[rid]
			virtual := virtualList[CellLevel(len(virtualList))][0].(*VirtualCell)
			virtual.SetPhysicalCell(physical)
			physical.SetVirtualCell(virtual)
			klog.Infof("Cells bound: %v and %v (reservation)", virtual.GetName(), physical.GetName())
		}
	}
}

// scheduleNewAffinityGroup schedules each pod of a new affinity group to a set of GPUs
// (in both the physical cluster and the VC).
func (h *HivedAlgorithm) scheduleNewAffinityGroup(
	pod *core.Pod,
	s *api.PodSchedulingSpec) (map[int32][]CellList, map[int32][]CellList) {

	var (
		physicalPlacement map[int32][]CellList
		virtualPlacement  map[int32][]CellList
		priority          CellPriority
	)
	if s.Priority < api.RegularPriority {
		priority = opportunisticPriority
	} else {
		priority = CellPriority(s.Priority)
	}
	sr := schedulingRequest{
		vc:            s.VirtualCluster,
		reservationId: s.ReservationId,
		priority:      priority,
		affinityGroup: map[int32]int32{},
	}
	for _, m := range s.AffinityGroup.Members {
		sr.affinityGroup[m.GpuNumber] = m.PodNumber
	}
	h.validateSchedulingRequest(sr, pod)
	if sr.reservationId != "" {
		klog.Infof("Use reservation %v", s.ReservationId)
		sr.chain = h.reservedCells[sr.vc][sr.reservationId].GetChain()
		physicalPlacement, virtualPlacement = h.processSchedulingRequest(sr)
	} else {
		physicalPlacement, virtualPlacement = h.scheduleAffinityGroupForGpuType(sr, s.GpuType, pod)
	}
	if physicalPlacement != nil {
		klog.Infof("Succeeded scheduling group %v", s.AffinityGroup.Name)
	} else {
		klog.Infof("Failed to schedule group %v", s.AffinityGroup.Name)
	}
	return physicalPlacement, virtualPlacement
}

// scheduleAffinityGroupForGpuType schedules an affinity group in a certain cell chain.
// If a GPU type is specified, it will be scheduled to a chain that contains this GPU type.
// Otherwise any GPU type will be tried.
func (h *HivedAlgorithm) scheduleAffinityGroupForGpuType(
	sr schedulingRequest,
	gpuType string,
	pod *core.Pod) (map[int32][]CellList, map[int32][]CellList) {

	if gpuType != "" {
		if chains := h.chains[gpuType]; chains == nil {
			panic(internal.NewBadRequestError(fmt.Sprintf(
				"[%v]: pod requesting an invalid GPU type: %v", internal.Key(pod), gpuType)))
		} else {
			vcHasType := false
			for _, chain := range chains {
				if h.vcSchedulers[sr.vc].getNonReservedCellList()[chain] != nil {
					vcHasType = true
				}
				sr.chain = chain
				if physicalPlacement, virtualPlacement := h.processSchedulingRequest(sr); physicalPlacement != nil {
					return physicalPlacement, virtualPlacement
				}
			}
			if sr.priority >= regularPriority && !vcHasType {
				panic(internal.NewBadRequestError(fmt.Sprintf(
					"[%v]: pod requesting GPU type %v which VC %v does not have",
					internal.Key(pod), gpuType, sr.vc)))
			}
		}
	} else {
		for _, chains := range h.chains {
			for _, chain := range chains {
				sr.chain = chain
				if physicalPlacement, virtualPlacement := h.processSchedulingRequest(sr); physicalPlacement != nil {
					return physicalPlacement, virtualPlacement
				}
			}
		}
	}
	return nil, nil
}

// validateSchedulingRequest checks the existence of VC and reservation ID, and the legality of priority.
func (h *HivedAlgorithm) validateSchedulingRequest(sr schedulingRequest, pod *core.Pod) {
	var message string
	if h.vcSchedulers[sr.vc] == nil {
		message = fmt.Sprintf("VC %v does not exists!", sr.vc)
	} else if sr.reservationId != "" {
		if h.vcSchedulers[sr.vc].getReservedCellList()[sr.reservationId] == nil {
			message = fmt.Sprintf("VC %v does not have reservation %v", sr.vc, sr.reservationId)
		} else if sr.priority < regularPriority {
			message = fmt.Sprintf("opportunistic pod not supported to use reservation %v", sr.reservationId)
		}
	} else if sr.priority > highestPriority {
		message = fmt.Sprintf("priority %v exceeds highest priority", sr.priority)
	}
	if message != "" {
		panic(internal.NewBadRequestError(fmt.Sprintf("[%v]: %v", internal.Key(pod), message)))
	}
}

// processSchedulingRequest feeds a request to a VC scheduler
// or the opportunistic scheduler according to its priority.
func (h *HivedAlgorithm) processSchedulingRequest(sr schedulingRequest) (map[int32][]CellList, map[int32][]CellList) {
	if sr.priority >= regularPriority {
		return h.scheduleRegularAffinityGroup(sr)
	} else {
		return h.scheduleOpportunisticAffinityGroup(sr), nil
	}
}

// scheduleRegularAffinityGroup schedules an affinity group in its VC, and
// then maps the placement in VC to the physical cluster.
func (h *HivedAlgorithm) scheduleRegularAffinityGroup(sr schedulingRequest) (map[int32][]CellList, map[int32][]CellList) {
	// schedule in VC
	virtualPlacement := h.vcSchedulers[sr.vc].schedule(sr)
	if virtualPlacement == nil {
		return nil, nil
	}
	// map the vc placement to the physical cluster
	gpuNums := make([]int32, len(sr.affinityGroup))
	i := 0
	for n := range sr.affinityGroup {
		gpuNums[i] = n
		i++
	}
	common.SortInt32(gpuNums)
	physicalPlacement := map[int32][]CellList{}
	for _, podGpuNum := range gpuNums {
		podPlacements := virtualPlacement[podGpuNum]
		physicalPlacement[podGpuNum] = make([]CellList, len(podPlacements))
		for i, podGpus := range podPlacements {
			physicalPlacement[podGpuNum][i] = make(CellList, len(podGpus))
			for j, gpu := range podGpus {
				vGpu := gpu.(*VirtualCell)
				pac := vGpu.GetPreAssignedCell()
				// check if the preassigned cell has been (temporarily) bound to a physical cell
				preassignedPhysical := pac.GetPhysicalCell()
				if preassignedPhysical == nil {
					preassignedPhysical = pac.GetPreBoundVirtualCell()
				}
				if preassignedPhysical == nil {
					// allocate a new physical cell to the preassigned cell. input a copy of the free cell list
					// because during the scheduling we should not make in-place change to the data structures
					c := buddyAlloc(h.getTmpFreeCellList(sr.chain), pac.GetLevel())
					if c == nil {
						panic(fmt.Sprintf(
							"Cannot find physical cell for a VC cell: %v", pac.GetName()))
					} else {
						preassignedPhysical = c
						// create binding (which is temporary and will be cleared after the scheduling,
						// same reason as above)
						pac.SetPreBoundVirtualCell(preassignedPhysical)
						preassignedPhysical.SetPreBoundVirtualCell(pac)
					}
				}
				physicalPlacement[podGpuNum][i][j] = mapNonPreassignedCellToPhysical(vGpu)
			}
		}
	}
	clearTmpBindings(virtualPlacement)
	return physicalPlacement, virtualPlacement
}

// scheduleOpportunisticAffinityGroup calls the opportunistic pod scheduler to schedule an affinity group.
func (h *HivedAlgorithm) scheduleOpportunisticAffinityGroup(sr schedulingRequest) map[int32][]CellList {
	return h.opportunisticSchedulers[sr.chain].Schedule(sr.affinityGroup, opportunisticPriority)
}

// getTmpFreeCellList returns a copy of the free cell list.
func (h *HivedAlgorithm) getTmpFreeCellList(chain CellChain) ChainCellList {
	ccl := ChainCellList{}
	for l := CellLevel(1); l <= CellLevel(len(h.freeCellList[chain])); l++ {
		ccl[l] = make(CellList, len(h.freeCellList[chain][l]))
		copy(ccl[l], h.freeCellList[chain][l])
	}
	return ccl
}

// confirmAllocatedGpu creates the cell bindings, removes the physical cell from the free list
// (if necessary), and sets the priority.
func (h *HivedAlgorithm) confirmAllocatedGpu(
	pGpu *PhysicalCell,
	vGpu *VirtualCell,
	p CellPriority,
	g *AlgoAffinityGroup) {

	physicalPriority := p
	if vGpu != nil {
		preassignedNewlyBound := vGpu.GetPreAssignedCell().GetPhysicalCell() == nil
		bindCell(pGpu, vGpu)
		if preassignedNewlyBound {
			// remove the allocated cell from the free list (possibly splitting cells)
			h.removeCellFromFreeList(vGpu.GetPreAssignedCell().GetPhysicalCell())
		}
		vGpu.SetPriority(p)
		updateUsedGpuNumAtPriority(vGpu, p, true)
	} else {
		physicalPriority = opportunisticPriority
	}
	pGpu.SetPriority(physicalPriority)
	updateUsedGpuNumAtPriority(pGpu, physicalPriority, true)
	pGpu.AddAffinityGroup(g)
}

// confirmReleasedGpu destroys the cell bindings, adds the physical cell back to the free list
// (if necessary), and resets the priority.
func (h *HivedAlgorithm) confirmReleasedGpu(pGpu *PhysicalCell, g *AlgoAffinityGroup) {
	if vGpu := pGpu.GetVirtualCell(); vGpu != nil {
		preassignedPhysical := vGpu.GetPreAssignedCell().GetPhysicalCell()
		unbindCell(pGpu)
		if vGpu.GetPreAssignedCell().GetPhysicalCell() == nil {
			// add the released cell back to the free list (possibly merging cells)
			h.addCellToFreeList(preassignedPhysical)
		}
		updateUsedGpuNumAtPriority(vGpu, vGpu.GetPriority(), false)
		vGpu.SetPriority(freePriority)
	}
	updateUsedGpuNumAtPriority(pGpu, pGpu.GetPriority(), false)
	pGpu.SetPriority(freePriority)
	pGpu.DeleteAffinityGroup(g)
}

// removeCellFromFreeList removes a cell from the free cell list and splits its parent recursively if needed.
func (h *HivedAlgorithm) removeCellFromFreeList(c *PhysicalCell) {
	chain := c.GetChain()
	terminate := false
	for {
		l := c.GetLevel()
		parent := c.GetParent()
		if parent != nil {
			pp := parent.(*PhysicalCell)
			if pp.IsSplit() {
				terminate = true
			} else {
				h.freeCellList[chain][l] = append(h.freeCellList[chain][l], pp.GetChildren()...)
				pp.SetSplit(true)
			}
		} else {
			terminate = true
		}
		h.freeCellList[chain].remove(c, l)
		if terminate {
			break
		} else {
			c = parent.(*PhysicalCell)
		}
	}
}

// addCellToFreeList adds a cell to the free cell list and merges its buddies recursively if needed.
func (h *HivedAlgorithm) addCellToFreeList(c *PhysicalCell) {
	chain := c.GetChain()
	terminate := false
	for {
		l := c.GetLevel()
		parent := c.GetParent()
		if parent != nil {
			allBuddyFree := true
			for _, buddy := range parent.GetChildren() {
				if buddy.(*PhysicalCell).GetVirtualCell() != nil {
					allBuddyFree = false
					break
				}
			}
			if !allBuddyFree {
				terminate = true
			} else {
				for _, buddy := range parent.GetChildren() {
					if !CellEqual(buddy, c) {
						h.freeCellList[chain].remove(buddy, l)
					}
				}
				parent.(*PhysicalCell).SetSplit(false)
			}
		} else {
			terminate = true
		}
		if terminate {
			h.freeCellList[chain][l] = append(h.freeCellList[chain][l], c)
			break
		} else {
			c = parent.(*PhysicalCell)
		}
	}
}

// findPhysicalGpu finds a physical GPU cell in the full list. This search is based on *one* node
// and *one* GPU index, assuming there is no resource overlapping among cells at the same level.
func (h *HivedAlgorithm) findPhysicalGpu(
	chain CellChain,
	node string,
	gpuIndex int32) *PhysicalCell {

	for _, c := range h.fullCellList[chain][1] {
		success := false
		cc := c.(*PhysicalCell)
		nodes, gpuIndices := cc.GetPhysicalPlacement()
		for _, n := range nodes {
			if n == node {
				success = true
				break
			}
		}
		if success {
			if gpuIndex < 0 {
				return cc
			} else {
				for _, g := range gpuIndices {
					if g == gpuIndex {
						return cc
					}
				}
			}
		}
	}
	return nil
}

// findVirtualGpu finds a virtual GPU cell according to the cell index.
func (h *HivedAlgorithm) findVirtualGpu(
	vc api.VirtualClusterName,
	chain CellChain,
	rid api.ReservationId,
	index int32) *VirtualCell {

	if index >= 0 {
		var searchList CellList
		if rid == "" {
			searchList = h.vcSchedulers[vc].getNonReservedCellList()[chain][1]
		} else {
			searchList = h.vcSchedulers[vc].getReservedCellList()[rid][1]
		}

		for _, c := range searchList {
			cc := c.(*VirtualCell)
			if cc.GetIndex() == index {
				return cc
			}
		}
	}
	return nil
}

// generatePodScheduleResult writes the scheduling result into a PodScheduleResult.
func generatePodScheduleResult(
	groupPhysicalPlacement map[int32][]CellList,
	groupVirtualPlacement map[int32][]CellList,
	currentGpuNum int32,
	currentPodIndex int32,
	newGroup bool,
	suggestedNodes []string,
	pod *core.Pod) internal.PodScheduleResult {

	if groupPhysicalPlacement == nil {
		return internal.PodScheduleResult{
			PodWaitInfo: &internal.PodWaitInfo{
				FailedNodeReasons: map[string]string{},
			},
		}
	} else {
		affinityGroupBindInfo, selectedNode, selectedGpuIndices := generateAffinityGroupBindInfo(
			groupPhysicalPlacement, groupVirtualPlacement, currentGpuNum, currentPodIndex)
		chain := string(groupPhysicalPlacement[currentGpuNum][currentPodIndex][0].GetChain())
		if !common.StringsContains(suggestedNodes, selectedNode) {
			panic(fmt.Sprintf("[%v]: node %v picked by algorithm but not in K8S candidates",
				internal.Key(pod), selectedNode))
		}
		// collect preemption victims
		needPreemption := false
		preemptionVictims := common.NewSet()
		if newGroup {
			// if any of the GPUs allocated for the whole group is still used by a pod,
			// we will wait for the preemption, as the group is gang-scheduled.
			for gpuNum := range groupPhysicalPlacement {
				for podIndex := range groupPhysicalPlacement[gpuNum] {
					for _, gpu := range groupPhysicalPlacement[gpuNum][podIndex] {
						pGpu := gpu.(*PhysicalCell)
						if pGpu.HasAffinityGroup() {
							needPreemption = true
							break
						}
					}
				}
			}
			for _, gpu := range groupPhysicalPlacement[currentGpuNum][currentPodIndex] {
				pGpu := gpu.(*PhysicalCell)
				if pGpu.HasAffinityGroup() {
					// for any victim pod, gang-preempt all the other pods from the same affinity group
					for _, victims := range pGpu.GetAffinityGroups()[0].allocatedPods {
						for _, victimPod := range victims {
							preemptionVictims.Add(victimPod)
						}
					}
				}
			}
		}
		if needPreemption {
			var victimPods []*core.Pod
			var victimNames []string
			for v := range preemptionVictims.Items() {
				victimPods = append(victimPods, v.(*core.Pod))
				victimNames = append(victimNames, internal.Key(v.(*core.Pod)))
			}
			klog.Infof("[%v]: need to preempt pods %v", internal.Key(pod), victimNames)
			return internal.PodScheduleResult{
				PodPreemptInfo: &internal.PodPreemptInfo{VictimPods: victimPods},
			}
		} else {
			klog.Infof("[%v]: scheduled to node %v, GPUs %v",
				internal.Key(pod), selectedNode, selectedGpuIndices)
			return internal.PodScheduleResult{
				PodBindInfo: &api.PodBindInfo{
					Node:                  selectedNode,
					GpuIsolation:          selectedGpuIndices,
					CellChain:             chain,
					AffinityGroupBindInfo: affinityGroupBindInfo,
				},
			}
		}
	}
}

// generateAffinityGroupBindInfo writes the physical and virtual placements of an affinity group
// into a a series of AffinityGroupMemberBindInfos, and returns the allocated node and GPU addresses
// of the current pod.
func generateAffinityGroupBindInfo(
	groupPhysicalPlacement map[int32][]CellList,
	groupVirtualPlacement map[int32][]CellList,
	currentGpuNum int32,
	currentPodIndex int32) ([]api.AffinityGroupMemberBindInfo, string, []int32) {

	affinityGroupBindInfo := make([]api.AffinityGroupMemberBindInfo, len(groupPhysicalPlacement))
	var selectedNode string
	var selectedGpuIndices []int32
	groupMemberIndex := 0
	for podGpuNum, podPhysicalPlacements := range groupPhysicalPlacement {
		mbi := api.AffinityGroupMemberBindInfo{
			PodPlacements: make([]api.PodPlacementInfo, len(podPhysicalPlacements)),
		}
		for podIndex := int32(0); podIndex < int32(len(podPhysicalPlacements)); podIndex++ {
			mbi.PodPlacements[podIndex].PhysicalGpuIndices = make(
				[]int32, len(podPhysicalPlacements[podIndex]))
			mbi.PodPlacements[podIndex].VirtualCellIndices = make(
				[]int32, len(podPhysicalPlacements[podIndex]))
			for gpuIndex := 0; gpuIndex < len(podPhysicalPlacements[podIndex]); gpuIndex++ {
				pGpu := podPhysicalPlacements[podIndex][gpuIndex].(*PhysicalCell)
				nodes, gpuIndices := pGpu.GetPhysicalPlacement()
				// here each cell (i.e., pGpu) is only one GPU, hence we takes the first element
				// in its "nodes" and "gpuIndices" as the node and GPU address
				if mbi.PodPlacements[podIndex].PhysicalNode == "" {
					mbi.PodPlacements[podIndex].PhysicalNode = nodes[0]
				}
				mbi.PodPlacements[podIndex].PhysicalGpuIndices[gpuIndex] = gpuIndices[0]
				if groupVirtualPlacement != nil {
					vGpu := groupVirtualPlacement[podGpuNum][podIndex][gpuIndex].(*VirtualCell)
					mbi.PodPlacements[podIndex].VirtualCellIndices[gpuIndex] = vGpu.GetIndex()
				} else {
					mbi.PodPlacements[podIndex].VirtualCellIndices[gpuIndex] = -1
				}
			}
		}
		if podGpuNum == currentGpuNum {
			selectedNode = mbi.PodPlacements[currentPodIndex].PhysicalNode
			selectedGpuIndices = mbi.PodPlacements[currentPodIndex].PhysicalGpuIndices
		}
		affinityGroupBindInfo[groupMemberIndex] = mbi
		groupMemberIndex++
	}
	return affinityGroupBindInfo, selectedNode, selectedGpuIndices
}

// buddyAlloc allocates a free cell at a certain level from a free list.
// It splits a higher-level cell when there is no free cell at the current level.
// As the input cell list is a copy of the real free list and hence is one-off,
// we won't remove a returned cell from it.
func buddyAlloc(freeList ChainCellList, level CellLevel) *PhysicalCell {
	if len(freeList[level]) == 0 && level < CellLevel(len(freeList)) {
		higherCell := buddyAlloc(freeList, level+1)
		if higherCell != nil {
			freeList[level] = append(freeList[level], higherCell.GetChildren()...)
		}
	}
	if len(freeList[level]) == 0 {
		return nil
	}
	return minOpportunisticCell(freeList[level])
}

// minOpportunisticCell selects a cell with the minimum number of opportunistic pods from a cell list.
func minOpportunisticCell(cl CellList) *PhysicalCell {
	mo := int32(math.MaxInt32)
	var moc *PhysicalCell
	for _, c := range cl {
		if pc := c.(*PhysicalCell); pc.GetVirtualCell() == nil && pc.GetPreBoundVirtualCell() == nil &&
			pc.GetUsedGpuNumAtPriorities()[opportunisticPriority] < mo {
			mo = pc.GetUsedGpuNumAtPriorities()[opportunisticPriority]
			moc = pc
		}
	}
	return moc
}

// mapNonPreassignedCellToPhysical maps a virtual cell (possibly inside a preassigned one) to the
// physical cell of the preassigned cell. This operation keeps the inner-cell topology equivalent,
// by recursively binding the cells inside the preassigned one.
func mapNonPreassignedCellToPhysical(c *VirtualCell) *PhysicalCell {
	if c.GetPhysicalCell() != nil {
		return c.GetPhysicalCell()
	} else if c.GetPreBoundVirtualCell() != nil {
		return c.GetPreBoundVirtualCell()
	} else {
		parentPhysical := mapNonPreassignedCellToPhysical(c.GetParent().(*VirtualCell))
		pc := minOpportunisticCell(parentPhysical.GetChildren())
		if pc == nil || pc.GetPriority() > opportunisticPriority {
			panic(fmt.Sprintf("Cannot find physical cell for %v", c.GetName()))
		}
		c.SetPreBoundVirtualCell(pc)
		pc.SetPreBoundVirtualCell(c)
		return pc
	}
}

// clearTmpBindings clears the temporary bindings created during scheduling.
func clearTmpBindings(virtualPlacement map[int32][]CellList) {
	for _, podPlacements := range virtualPlacement {
		for _, podGpus := range podPlacements {
			for _, gpu := range podGpus {
				for gpu != nil {
					vGpu := gpu.(*VirtualCell)
					if pGpu := vGpu.GetPreBoundVirtualCell(); pGpu != nil {
						pGpu.SetPreBoundVirtualCell(nil)
						vGpu.SetPreBoundVirtualCell(nil)
						gpu = gpu.GetParent()
					} else {
						break
					}
				}
			}
		}
	}
}

// bindCell binds a virtual cell to a physical cell and its parent recursively.
func bindCell(pc *PhysicalCell, vc *VirtualCell) {
	for vc.GetPhysicalCell() == nil {
		vc.SetPhysicalCell(pc)
		pc.SetVirtualCell(vc)
		klog.Infof("Cells bound: %v and %v", vc.GetName(), pc.GetName())
		if vc.GetParent() == nil {
			break
		}
		vc = vc.GetParent().(*VirtualCell)
		pc = pc.GetParent().(*PhysicalCell)
	}
}

// unbindCell unbinds a virtual cell with a physical cell and its parent recursively.
func unbindCell(c *PhysicalCell) {
	boundVirtual := c.GetVirtualCell()
	for !boundVirtual.GetPhysicalCell().IsReserved() {
		boundPhysical := boundVirtual.GetPhysicalCell()
		klog.Infof("Cells unbound: %v and %v", boundVirtual.GetName(), boundPhysical.GetName())
		boundPhysical.SetVirtualCell(nil)
		boundVirtual.SetPhysicalCell(nil)
		if boundVirtual.GetParent() == nil {
			break
		} else {
			unbindParent := true
			for _, cc := range boundVirtual.GetParent().GetChildren() {
				if child := cc.(*VirtualCell); child.GetPhysicalCell() != nil {
					unbindParent = false
					break
				}
			}
			if !unbindParent {
				break
			}
			boundVirtual = boundVirtual.GetParent().(*VirtualCell)
		}
	}
}

// updateUsedGpuNumAtPriority updates the number of used GPUs at a priority for a cell
// and its parent recursively.
func updateUsedGpuNumAtPriority(c Cell, p CellPriority, increase bool) {
	for c != nil {
		delta := int32(-1)
		if increase {
			delta = 1
		}
		c.IncreaseUsedGpuNumAtPriority(p, delta)
		c = c.GetParent()
	}
}
