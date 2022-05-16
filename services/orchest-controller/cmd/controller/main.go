package main

import (
	"os"

	"github.com/orchest/orchest/services/orchest-controller/cmd/controller/cmd"
)

func main() {

	command := cmd.NewControllerCommand()

	if err := command.Execute(); err != nil {
		os.Exit(1)
	}
}
