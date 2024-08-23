package pimg

import (
	"encoding/hex"
	"strconv"
)

type Config struct {
	key  []byte
	salt []byte
}

func New(key, salt string) *Config {
	keyBin, err := hex.DecodeString(key)
	if err != nil {
		panic(err)
	}

	saltBin, err := hex.DecodeString(salt)
	if err != nil {
		panic(err)
	}

	return &Config{key: keyBin, salt: saltBin}
}

type Builder struct {
	c    *Config
	src  string
	opts [][]string
}

func (c *Config) Source(src string) *Builder {
	return &Builder{c: c, src: src}
}

func (b *Builder) Width(width int) *Builder {
	return b.Process("w", strconv.Itoa(width))
}

func (b *Builder) Height(height int) *Builder {
	return b.Process("h", strconv.Itoa(height))
}

func (b *Builder) Dpr(dpr float32) *Builder {
	return b.Process("dpr", strconv.FormatFloat(float64(dpr), 'f', 2, 32))
}

type ResizingType string

const (
	ResizeFit      ResizingType = "fit"
	ResizeFill     ResizingType = "fill"
	ResizeFillDown ResizingType = "fill-down"
	ResizeForce    ResizingType = "force"
	ResizeAuto     ResizingType = "auto"
)

func (b *Builder) ResizingType(ty ResizingType) *Builder {
	return b.Process("rt", string(ty))
}

func (b *Builder) Process(option string, args ...string) *Builder {
	opt := make([]string, 0, len(args)+1)
	opt = append(opt, option)
	opt = append(opt, args...)
	b.opts = append(b.opts, opt)
	return b
}

func (b *Builder) Build(ext string) string {
	return imgproxyPath(b.c.key, b.c.salt, b.src, b.opts, ext)
}
