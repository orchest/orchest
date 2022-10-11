package utils

import (
	"fmt"
	"hash"
	"hash/fnv"

	"github.com/davecgh/go-spew/spew"
	"k8s.io/apimachinery/pkg/util/rand"
)

func Contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}

	return false
}

func Remove(list []string, s string) []string {
	for i, v := range list {
		if v == s {
			return append(list[:i], list[i+1:]...)
		}
	}
	return list
}

func ComputeHash(object interface{}) string {
	hasher := fnv.New32a()
	DeepHashObject(hasher, object)

	return rand.SafeEncodeString(fmt.Sprint(hasher.Sum32()))
}

func DeepHashObject(hasher hash.Hash, objectToWrite interface{}) {
	hasher.Reset()
	printer := spew.ConfigState{
		Indent:                  " ",
		SortKeys:                true,
		DisableMethods:          true,
		DisablePointerAddresses: true,
		SpewKeys:                true,
	}
	printer.Fprintf(hasher, "%#v", objectToWrite)
}

func GetCreatingEvent(component string) string {
	return fmt.Sprintf("Creating %s", component)
}

func GetCreatedEvent(component string) string {
	return fmt.Sprintf("Created %s", component)
}

func GetDeletingEvent(component string) string {
	return fmt.Sprintf("Deleting %s", component)
}

func GetDeletedEvent(component string) string {
	return fmt.Sprintf("Deleted %s", component)
}
