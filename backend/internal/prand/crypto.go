package prand

import (
	"crypto/rand"
	"fmt"
)

func CryptoRandHex(byteLen int) string {
	buf := make([]byte, byteLen)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	return fmt.Sprintf("%x", buf)
}
