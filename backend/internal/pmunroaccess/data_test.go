package pmunroaccess

import (
	"fmt"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestMunroStartClustersSanityCheck(t *testing.T) {
	assert.Greater(t, len(munroStartClusters), 100)
	fmt.Println(len(munroStartClusters))

	munros := make(map[string]struct{})
	for _, cluster := range munroStartClusters {
		assert.Less(t, len(cluster.Munros), 30)

		for _, munro := range cluster.Munros {
			munros[munro] = struct{}{}
		}
	}
	assert.Len(t, munros, 282)
}
