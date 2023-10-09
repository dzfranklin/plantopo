package session

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"path"
	"regexp"
	"strings"
	"testing"
	"time"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"golang.org/x/exp/slices"
	"sigs.k8s.io/yaml"
)

//go:embed scenario_tests/*.scenario
var fs embed.FS

func init() {
	l, err := zap.NewDevelopment()
	if err != nil {
		panic(err)
	}
	zap.ReplaceGlobals(l)
}

func TestScenarios(t *testing.T) {
	scenarios := getScenarios(t)
	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			fmt.Println(s.name)
			runScenario(t, s)
		})
	}
}

func TestScenario(t *testing.T) {
	name := "remove_two_layers.scenario"
	scenarios := getScenarios(t)
	for _, s := range scenarios {
		if s.name == name {
			runScenario(t, s)
			return
		}
	}
}

func runScenario(t *testing.T, s scenario) {
	l := zap.S()
	subject := makeSubject(t)
	conns := make(map[string]*Connection)
	for _, op := range s.ops {
		switch op := op.(type) {
		case connectOp:
			conn, err := subject.Connect(op.clientId)
			require.NoError(t, err)
			conns[op.clientId] = conn
		case incomingOp:
			conn, ok := conns[op.client]
			require.True(t, ok, "client %q not found", op.client)
			conn.Receive(op.value)
		case assertOp:
			subject.testTickSave()
			got := *subject.testGetLastSave()
			require.Equal(t, op.cset, got)
		case assertOutgoingOp:
			conn, ok := conns[op.client]
			require.True(t, ok, "client %q not found", op.client)
			time.Sleep(10 * time.Millisecond)
			select {
			case msg := <-conn.outgoing:
				require.Equal(t, op.value, msg)
			default:
				l.Panic("expected outgoing message to ", op.client)
			}
		case assertAnyOutgoingOp:
			conn, ok := conns[op.client]
			require.True(t, ok, "client %q not found", op.client)
			time.Sleep(10 * time.Millisecond)
			select {
			case <-conn.outgoing:
			default:
				l.Panic("expected outgoing message to ", op.client)
			}
		case assertNoreplyToOp:
			conn, ok := conns[op.client]
			require.True(t, ok, "client %q not found", op.client)
			time.Sleep(10 * time.Millisecond)
			select {
			case msg := <-conn.outgoing:
				l.Panicw("expected no outgoing message", "msg", msg)
			default:
			}
		default:
			panic(fmt.Errorf("unknown op type: %T", op))
		}

		l.Debugf("%T OK", op)
	}
}

func getScenarios(t *testing.T) []scenario {
	t.Helper()

	files, err := fs.ReadDir("scenario_tests")
	require.NoError(t, err)

	scenarios := make([]scenario, 0)
	for _, f := range files {
		if f.IsDir() {
			continue
		}
		name := f.Name()
		if !strings.HasSuffix(name, ".scenario") {
			continue
		}
		f, err := fs.Open(path.Join("scenario_tests", name))
		require.NoError(t, err)
		defer f.Close()
		raw, err := io.ReadAll(f)
		require.NoError(t, err)
		scenarios = append(scenarios, parse(name, string(raw)))
	}

	slices.SortFunc(scenarios, func(i, j scenario) int {
		return strings.Compare(i.name, j.name)
	})

	return scenarios
}

type scenario struct {
	name string
	ops  []interface{}
}

type connectOp struct {
	clientId string
}

type assertOp struct {
	cset schema.Changeset
}

type incomingOp struct {
	client string
	value  Incoming
}

type assertOutgoingOp struct {
	client string
	value  Outgoing
}

type assertAnyOutgoingOp struct {
	client string
}

type assertNoreplyToOp struct {
	client string
}

func parse(name string, raw string) scenario {
	r := myReader{name, strings.NewReader(raw)}
	s := scenario{name: name, ops: make([]interface{}, 0)}
	for !r.IsEOF() {
		r.SkipWhitespace()
		switch r.MustReadByte() {
		case '/':
			r.MustConsume("/")
			for {
				b := r.MustReadByte()
				if b == '\n' {
					break
				}
			}
		case '=':
			r.SkipSpace()
			if r.TryConsume("noreplyto ") {
				client := r.MustReadIdent()
				s.ops = append(s.ops, assertNoreplyToOp{client})
				continue
			}

			r.MustConsume("\n")
			value := r.ReadCSet()
			s.ops = append(s.ops, assertOp{value})
		case '<':
			r.SkipSpace()

			if r.TryConsume("CONNECT ") {
				clientId := r.MustReadIdent()
				s.ops = append(s.ops, connectOp{clientId})
				continue
			}

			client := r.MustReadIdent()
			r.MustConsume("\n")
			value := r.ReadIncoming()
			s.ops = append(s.ops, incomingOp{client, value})
		case '>':
			r.SkipSpace()
			client := r.MustReadIdent()
			r.MustConsume("\n")
			if r.HasIndent() {
				value := r.ReadOutgoing()
				s.ops = append(s.ops, assertOutgoingOp{client, value})
			} else {
				s.ops = append(s.ops, assertAnyOutgoingOp{client})
			}
		}
	}
	return s
}

type myReader struct {
	name string
	*strings.Reader
}

func (r *myReader) IsEOF() bool {
	_, err := r.ReadByte()
	if err != nil {
		if err == io.EOF {
			return true
		} else {
			panic(fmt.Errorf("unexpected error reading %s: %w", r.name, err))
		}
	}
	r.UnreadByte()
	return false
}

func (r *myReader) MustReadByte() byte {
	v, err := r.ReadByte()
	if err != nil {
		if err == io.EOF {
			panic(fmt.Errorf("unexpected EOF reading %s", r.name))
		} else {
			panic(fmt.Errorf("unexpected error reading %s: %w", r.name, err))
		}
	}
	return v
}

func (r *myReader) TryConsume(pat string) bool {
	got := make([]byte, len(pat))
	gotN, err := r.Read(got)
	if err != nil {
		if err == io.EOF {
			r.Seek(-int64(gotN), io.SeekCurrent)
			return false
		} else {
			panic(fmt.Errorf("unexpected error reading %s: %w", r.name, err))
		}
	}
	if string(got) != pat {
		r.Seek(-int64(gotN), io.SeekCurrent)
		return false
	}
	return true
}

func (r *myReader) MustConsume(pat string) bool {
	if !r.TryConsume(pat) {
		panic(fmt.Errorf("expected %q in %s", pat, r.name))
	}
	return true
}

func (r *myReader) SkipSpace() {
	for {
		b, err := r.ReadByte()
		if err != nil {
			if err == io.EOF {
				return
			} else {
				panic(fmt.Errorf("unexpected error reading %s: %w", r.name, err))
			}
		}
		if b != ' ' {
			r.UnreadByte()
			return
		}
	}
}

func (r *myReader) SkipWhitespace() {
	for {
		b, err := r.ReadByte()
		if err != nil {
			if err == io.EOF {
				return
			} else {
				panic(fmt.Errorf("unexpected error reading %s: %w", r.name, err))
			}
		}
		if b != ' ' || b == '\t' || b == '\n' || b == '\r' {
			r.UnreadByte()
			return
		}
	}
}

func (r *myReader) UnreadToLineStart() {
	_ = r.UnreadByte()
	for {
		b, err := r.ReadByte()
		if err != nil {
			if err == io.EOF {
				panic(fmt.Errorf("unexpected EOF reading %s", r.name))
			} else {
				panic(fmt.Errorf("unexpected error reading %s: %w", r.name, err))
			}
		}
		if b == '\n' {
			return
		}
		r.UnreadByte()
		r.UnreadByte()
	}
}

var identPat = regexp.MustCompile(`[a-zA-Z0-9_-]`)

func (r *myReader) MustReadIdent() string {
	var sb strings.Builder
	for {
		b, err := r.ReadByte()
		if err != nil {
			if err == io.EOF {
				return sb.String()
			} else {
				panic(fmt.Errorf("unexpected error reading %s: %w", r.name, err))
			}
		}
		if identPat.Match([]byte{b}) {
			sb.WriteByte(b)
		} else {
			r.UnreadByte()
			return sb.String()
		}
	}
}

func (r *myReader) ReadIncoming() Incoming {
	block := r.ReadBlock()
	j, err := yaml.YAMLToJSONStrict([]byte(block))
	if err != nil {
		panic(fmt.Errorf("failed to parse YAML in %s: %w\n\n%s", r.name, err, block))
	}
	var v Incoming
	err = json.Unmarshal(j, &v)
	if err != nil {
		panic(fmt.Errorf("failed to unmarshal JSON to cset in %s: %w", r.name, err))
	}
	return v
}

func (r *myReader) ReadOutgoing() Outgoing {
	block := r.ReadBlock()
	j, err := yaml.YAMLToJSONStrict([]byte(block))
	if err != nil {
		panic(fmt.Errorf("failed to parse YAML in %s: %w\n\n%s", r.name, err, block))
	}
	var v Outgoing
	err = json.Unmarshal(j, &v)
	if err != nil {
		panic(fmt.Errorf("failed to unmarshal JSON to cset in %s: %w", r.name, err))
	}
	return v
}

func (r *myReader) ReadCSet() schema.Changeset {
	block := r.ReadBlock()
	j, err := yaml.YAMLToJSONStrict([]byte(block))
	if err != nil {
		panic(fmt.Errorf("failed to parse YAML in %s: %w\n\n%s", r.name, err, block))
	}
	var v schema.Changeset
	err = json.Unmarshal(j, &v)
	if err != nil {
		panic(fmt.Errorf("failed to unmarshal JSON to cset in %s: %w", r.name, err))
	}
	return v
}

const indent = 2

func (r *myReader) HasIndent() bool {
	for i := 0; i < indent; i++ {
		b, err := r.ReadByte()
		if err != nil {
			if err == io.EOF {
				return false
			} else {
				panic(fmt.Errorf("unexpected error reading %s: %w", r.name, err))
			}
		}
		if b != ' ' {
			r.UnreadByte()
			return false
		}
	}
	for i := 0; i < indent; i++ {
		r.UnreadByte()
	}
	return true
}

func (r *myReader) ReadBlock() string {
	var sb strings.Builder
	for {
		// read indent
		for i := 0; i < indent; i++ {
			b, err := r.ReadByte()
			if err != nil {
				if err == io.EOF {
					return sb.String()
				} else {
					panic(fmt.Errorf("unexpected error reading %s: %w", r.name, err))
				}
			}
			if b != ' ' {
				r.UnreadByte()
				return sb.String()
			}
		}

		// read line
		for {
			b, err := r.ReadByte()
			if err != nil {
				if err == io.EOF {
					return sb.String()
				} else {
					panic(fmt.Errorf("unexpected error reading %s: %w", r.name, err))
				}
			}
			sb.WriteByte(b)
			if b == '\n' {
				break
			}
		}
	}
}
