package utils

import (
	"hash"

	"github.com/davecgh/go-spew/spew"
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
