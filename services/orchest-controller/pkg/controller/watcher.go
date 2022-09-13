package controller

import (
	"fmt"
	"reflect"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type Watcher[WatchObject, ControllerObject client.Object] struct {
	*Controller[ControllerObject]

	controllerWatcher bool
}

func NewControllerWatcher[ControllerObject client.Object](ctrl *Controller[ControllerObject]) Watcher[ControllerObject, ControllerObject] {
	return Watcher[ControllerObject, ControllerObject]{
		Controller:        ctrl,
		controllerWatcher: true,
	}
}

func NewControlleeWatcher[WatchObject, ControllerObject client.Object](ctrl *Controller[ControllerObject]) Watcher[WatchObject, ControllerObject] {
	return Watcher[WatchObject, ControllerObject]{
		Controller:        ctrl,
		controllerWatcher: false,
	}
}

func (w *Watcher[WatchObject, ControllerObject]) AddObject(obj interface{}) {
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return
	}

	if accessor.GetDeletionTimestamp() != nil {
		w.DeleteObject(obj)
		return
	}

	if w.controllerWatcher {
		w.Enqueue(obj)
		return
	}

	// If it has a ControllerRef, we should process it.
	if controllerRef := metav1.GetControllerOf(accessor); controllerRef != nil {
		oc := w.resolveControllerRef(accessor.GetNamespace(), controllerRef)
		if oc == nil {
			return
		}
		/*
			ocKey, err := KeyFunc(oc)
			if err != nil {
				return
			}
			klog.V(4).Infof("Deployment %s added.", dep.Name)
			occ.expectations.CreationObserved(ocKey)
		*/
		w.Enqueue(oc)
		return
	}
}

func (w *Watcher[WatchObject, ControllerObject]) UpdateObject(old, cur interface{}) {
	curObj := cur.(WatchObject)
	oldObj := old.(WatchObject)
	if curObj.GetResourceVersion() == oldObj.GetResourceVersion() {
		return
	}

	if curObj.GetDeletionTimestamp() != nil {
		w.DeleteObject(curObj)
		return
	}

	if w.controllerWatcher {
		w.Enqueue(cur.(ControllerObject))
		return
	}

	curControllerRef := metav1.GetControllerOf(curObj)
	oldControllerRef := metav1.GetControllerOf(oldObj)
	controllerRefChanged := !reflect.DeepEqual(curControllerRef, oldControllerRef)
	if controllerRefChanged && oldControllerRef != nil {
		// The ControllerRef was changed. Sync the old controller, if any.
		if oc := w.resolveControllerRef(oldObj.GetNamespace(), oldControllerRef); oc != nil {
			w.Enqueue(oc)
		}
	}

	// If it has a ControllerRef, that's all that matters.
	if curControllerRef != nil {
		oc := w.resolveControllerRef(curObj.GetNamespace(), curControllerRef)
		if oc == nil {
			return
		}
		klog.V(4).Infof("Object %s updated.", curObj.GetName())
		w.Enqueue(oc)
		/*
			changedToReady := !utils.IsPodReady(oldDep) && utils.IsPodReady(curDep)
			if changedToReady {
				// TODO
			}
		*/
		return
	}
}

func (w *Watcher[WatchObject, ControllerObject]) DeleteObject(obj interface{}) {
	typedObj, ok := obj.(WatchObject)
	if !ok {
		tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
		if !ok {
			utilruntime.HandleError(fmt.Errorf("couldn't get object from tombstone %#v", obj))
			return
		}
		typedObj, ok = tombstone.Obj.(WatchObject)
		if !ok {
			utilruntime.HandleError(fmt.Errorf("tombstone contained object that is not of expected type %#v", obj))
			return
		}
	}

	if w.controllerWatcher {
		w.Enqueue(typedObj)
		return
	}

	controllerRef := metav1.GetControllerOf(typedObj)
	if controllerRef == nil {
		return
	}
	oc := w.resolveControllerRef(typedObj.GetNamespace(), controllerRef)
	if oc == nil {
		return
	}
	/*
		ocKey, err := KeyFunc(oc)
		if err != nil {
			return
		}
		klog.V(4).Infof("Deployment %s deleted.", dep.Name)
		occ.expectations.DeletionObserved(ocKey)
	*/
	w.Enqueue(oc)
}
