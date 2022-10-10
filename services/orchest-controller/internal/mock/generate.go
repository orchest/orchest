package mock

import _ "github.com/golang/mock/mockgen/model"

//go:generate mockgen -destination componentregistry/mock.go github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry Component
