package main

import (
	"sync"
)

type LabelledWaitGroup struct {
	mu     sync.Mutex
	active map[string]int
	wg     sync.WaitGroup
}

func (g *LabelledWaitGroup) Do(name string, fn func()) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.active == nil {
		g.active = make(map[string]int)
	}

	g.active[name]++
	g.wg.Add(1)
	go func() {
		defer func() {
			g.mu.Lock()
			defer g.mu.Unlock()

			g.active[name]--
			if g.active[name] == 0 {
				delete(g.active, name)
			}
			g.wg.Done()
		}()

		fn()
	}()
}

func (g *LabelledWaitGroup) Wait() {
	for {
		g.mu.Lock()
		if len(g.active) == 0 {
			g.mu.Unlock()
			return
		} else {
			g.mu.Unlock()
		}

		g.wg.Wait()
	}
}

func (g *LabelledWaitGroup) Active() []string {
	g.mu.Lock()
	defer g.mu.Unlock()
	out := make([]string, 0, len(g.active)*2)
	for label, count := range g.active {
		for i := 0; i < count; i++ {
			out = append(out, label)
		}
	}
	return out
}
