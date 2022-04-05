package main

import (
	"os"

	"github.com/orchest/orchest/services/orchest-controller/cmd/controller"
)

func main() {

	cmd := controller.NewControllerCommand()

	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
