#!/bin/bash

while getopts "c:" opt; do
  case $opt in
    c)
      CLUSTER_CONFIG=$OPTARG
      ;;
    \?)
      echo "Invalid option: -$OPTARG"
      exit 1
      ;;
  esac
done

OPENPAI_BRANCH_NAME=`cat ${CLUSTER_CONFIG} | grep branch_name | tr -d "[:space:]" | cut -d ':' -f 2`
OPENPAI_IMAGE_TAG=`cat ${CLUSTER_CONFIG} | grep docker_image_tag | tr -d "[:space:]" | cut -d ':' -f 2`

echo "Branch Name ${OPENPAI_BRANCH_NAME}"
echo "OpenPAI Image Tag ${OPENPAI_IMAGE_TAG}"

function cleanup(){
  sudo docker stop dev-box-quick-start &> /dev/null
  sudo docker rm dev-box-quick-start &> /dev/null
}

echo "Cleaning up..."
cleanup

sudo docker run -itd \
        -e COLUMNS=$COLUMNS -e LINES=$LINES -e TERM=$TERM \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v ${HOME}/pai-deploy/cluster-cfg:/cluster-configuration  \
        -v ${HOME}/pai-deploy/kube:/root/.kube \
        --pid=host \
        --privileged=true \
        --net=host \
        --name=dev-box-quick-start \
        openpai/dev-box:${OPENPAI_IMAGE_TAG}

sudo docker exec -it dev-box-quick-start kubectl get node || { cleanup; exit 1; }

# Work in dev-box
sudo docker exec -i dev-box-quick-start /bin/bash << EOF_DEV_BOX
set -e

echo "Generating services configurations..."
cd /pai && git checkout ${OPENPAI_BRANCH_NAME}
python3 /pai/contrib/kubespray/script/openpai-generator.py -l /cluster-configuration/layout.yaml -c /cluster-configuration/config.yaml -o /cluster-configuration

# TODO: This should be done at our source code.
kubectl create namespace pai-storage

# 1. Push cluster config to cluster
echo "Pushing cluster config to cluster..."
echo -e "pai\n" | python /pai/paictl.py config push -p /cluster-configuration -m service

# 2. Start OpenPAI service
echo "Starting OpenPAI services..."
echo -e "pai\n" | python /pai/paictl.py service start
EOF_DEV_BOX

if [ $? -ne 0 ]; then
  cleanup
  exit 1
else
  cleanup
  WEBPORTAL_URL=http:$(kubectl config view -o jsonpath='{.clusters[].cluster.server}' | cut -d ":" -f 2)
  echo ""
  echo "OpenPAI is successfully deployed, please check the following information:"
  echo "Kubernetes cluster config :     ~/pai-deploy/kube/config"
  echo "OpenPAI cluster config    :     ~/pai-deploy/cluster-cfg"
  echo "OpenPAI cluster ID        :     pai"
  echo "Default username          :     admin"
  echo "Default password          :     admin-password"
  echo ""
  echo "You can go to ${WEBPORTAL_URL}, then use the default username and password to log in."
fi
