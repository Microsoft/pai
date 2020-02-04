/*
Copyright The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Code generated by client-gen. DO NOT EDIT.

package v1

import (
	"time"

	v1 "github.com/microsoft/frameworkcontroller/pkg/apis/frameworkcontroller/v1"
	scheme "github.com/microsoft/frameworkcontroller/pkg/client/clientset/versioned/scheme"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
	watch "k8s.io/apimachinery/pkg/watch"
	rest "k8s.io/client-go/rest"
)

// FrameworksGetter has a method to return a FrameworkInterface.
// A group's client should implement this interface.
type FrameworksGetter interface {
	Frameworks(namespace string) FrameworkInterface
}

// FrameworkInterface has methods to work with Framework resources.
type FrameworkInterface interface {
	Create(*v1.Framework) (*v1.Framework, error)
	Update(*v1.Framework) (*v1.Framework, error)
	Delete(name string, options *metav1.DeleteOptions) error
	DeleteCollection(options *metav1.DeleteOptions, listOptions metav1.ListOptions) error
	Get(name string, options metav1.GetOptions) (*v1.Framework, error)
	List(opts metav1.ListOptions) (*v1.FrameworkList, error)
	Watch(opts metav1.ListOptions) (watch.Interface, error)
	Patch(name string, pt types.PatchType, data []byte, subresources ...string) (result *v1.Framework, err error)
	FrameworkExpansion
}

// frameworks implements FrameworkInterface
type frameworks struct {
	client rest.Interface
	ns     string
}

// newFrameworks returns a Frameworks
func newFrameworks(c *FrameworkcontrollerV1Client, namespace string) *frameworks {
	return &frameworks{
		client: c.RESTClient(),
		ns:     namespace,
	}
}

// Get takes name of the framework, and returns the corresponding framework object, and an error if there is any.
func (c *frameworks) Get(name string, options metav1.GetOptions) (result *v1.Framework, err error) {
	result = &v1.Framework{}
	err = c.client.Get().
		Namespace(c.ns).
		Resource("frameworks").
		Name(name).
		VersionedParams(&options, scheme.ParameterCodec).
		Do().
		Into(result)
	return
}

// List takes label and field selectors, and returns the list of Frameworks that match those selectors.
func (c *frameworks) List(opts metav1.ListOptions) (result *v1.FrameworkList, err error) {
	var timeout time.Duration
	if opts.TimeoutSeconds != nil {
		timeout = time.Duration(*opts.TimeoutSeconds) * time.Second
	}
	result = &v1.FrameworkList{}
	err = c.client.Get().
		Namespace(c.ns).
		Resource("frameworks").
		VersionedParams(&opts, scheme.ParameterCodec).
		Timeout(timeout).
		Do().
		Into(result)
	return
}

// Watch returns a watch.Interface that watches the requested frameworks.
func (c *frameworks) Watch(opts metav1.ListOptions) (watch.Interface, error) {
	var timeout time.Duration
	if opts.TimeoutSeconds != nil {
		timeout = time.Duration(*opts.TimeoutSeconds) * time.Second
	}
	opts.Watch = true
	return c.client.Get().
		Namespace(c.ns).
		Resource("frameworks").
		VersionedParams(&opts, scheme.ParameterCodec).
		Timeout(timeout).
		Watch()
}

// Create takes the representation of a framework and creates it.  Returns the server's representation of the framework, and an error, if there is any.
func (c *frameworks) Create(framework *v1.Framework) (result *v1.Framework, err error) {
	result = &v1.Framework{}
	err = c.client.Post().
		Namespace(c.ns).
		Resource("frameworks").
		Body(framework).
		Do().
		Into(result)
	return
}

// Update takes the representation of a framework and updates it. Returns the server's representation of the framework, and an error, if there is any.
func (c *frameworks) Update(framework *v1.Framework) (result *v1.Framework, err error) {
	result = &v1.Framework{}
	err = c.client.Put().
		Namespace(c.ns).
		Resource("frameworks").
		Name(framework.Name).
		Body(framework).
		Do().
		Into(result)
	return
}

// Delete takes name of the framework and deletes it. Returns an error if one occurs.
func (c *frameworks) Delete(name string, options *metav1.DeleteOptions) error {
	return c.client.Delete().
		Namespace(c.ns).
		Resource("frameworks").
		Name(name).
		Body(options).
		Do().
		Error()
}

// DeleteCollection deletes a collection of objects.
func (c *frameworks) DeleteCollection(options *metav1.DeleteOptions, listOptions metav1.ListOptions) error {
	var timeout time.Duration
	if listOptions.TimeoutSeconds != nil {
		timeout = time.Duration(*listOptions.TimeoutSeconds) * time.Second
	}
	return c.client.Delete().
		Namespace(c.ns).
		Resource("frameworks").
		VersionedParams(&listOptions, scheme.ParameterCodec).
		Timeout(timeout).
		Body(options).
		Do().
		Error()
}

// Patch applies the patch and returns the patched framework.
func (c *frameworks) Patch(name string, pt types.PatchType, data []byte, subresources ...string) (result *v1.Framework, err error) {
	result = &v1.Framework{}
	err = c.client.Patch(pt).
		Namespace(c.ns).
		Resource("frameworks").
		SubResource(subresources...).
		Name(name).
		Body(data).
		Do().
		Into(result)
	return
}
