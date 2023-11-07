package docstore

type stringSet map[string]struct{}

func stringSetOf(ids ...string) stringSet {
	s := make(stringSet)
	for _, id := range ids {
		s.add(id)
	}
	return s
}

func (s stringSet) add(id string) {
	s[id] = struct{}{}
}

func (s stringSet) has(id string) bool {
	_, ok := s[id]
	return ok
}
