// Code generated by ogen, DO NOT EDIT.

package papi

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/ogen-go/ogen/uri"
)

func (s *Server) cutPrefix(path string) (string, bool) {
	prefix := s.cfg.Prefix
	if prefix == "" {
		return path, true
	}
	if !strings.HasPrefix(path, prefix) {
		// Prefix doesn't match.
		return "", false
	}
	// Cut prefix from the path.
	return strings.TrimPrefix(path, prefix), true
}

// ServeHTTP serves http request as defined by OpenAPI v3 specification,
// calling handler that matches the path or returning not found error.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	elem := r.URL.Path
	elemIsEscaped := false
	if rawPath := r.URL.RawPath; rawPath != "" {
		if normalized, ok := uri.NormalizeEscapedPath(rawPath); ok {
			elem = normalized
			elemIsEscaped = strings.ContainsRune(elem, '%')
		}
	}

	elem, ok := s.cutPrefix(elem)
	if !ok || len(elem) == 0 {
		s.notFound(w, r)
		return
	}

	// Static code generated router with unwrapped path search.
	switch {
	default:
		if len(elem) == 0 {
			break
		}
		switch elem[0] {
		case '/': // Prefix: "/"
			origElem := elem
			if l := len("/"); len(elem) >= l && elem[0:l] == "/" {
				elem = elem[l:]
			} else {
				break
			}

			if len(elem) == 0 {
				break
			}
			switch elem[0] {
			case 'a': // Prefix: "auth/"
				origElem := elem
				if l := len("auth/"); len(elem) >= l && elem[0:l] == "auth/" {
					elem = elem[l:]
				} else {
					break
				}

				if len(elem) == 0 {
					break
				}
				switch elem[0] {
				case 'a': // Prefix: "authenticate"
					origElem := elem
					if l := len("authenticate"); len(elem) >= l && elem[0:l] == "authenticate" {
						elem = elem[l:]
					} else {
						break
					}

					if len(elem) == 0 {
						switch r.Method {
						case "POST":
							s.handleAuthAuthenticatePostRequest([0]string{}, elemIsEscaped, w, r)
						default:
							s.notAllowed(w, r, "POST")
						}

						return
					}
					switch elem[0] {
					case '-': // Prefix: "-browser"
						origElem := elem
						if l := len("-browser"); len(elem) >= l && elem[0:l] == "-browser" {
							elem = elem[l:]
						} else {
							break
						}

						if len(elem) == 0 {
							// Leaf node.
							switch r.Method {
							case "POST":
								s.handleAuthAuthenticateBrowserPostRequest([0]string{}, elemIsEscaped, w, r)
							default:
								s.notAllowed(w, r, "POST")
							}

							return
						}

						elem = origElem
					}

					elem = origElem
				case 'c': // Prefix: "check"
					origElem := elem
					if l := len("check"); len(elem) >= l && elem[0:l] == "check" {
						elem = elem[l:]
					} else {
						break
					}

					if len(elem) == 0 {
						// Leaf node.
						switch r.Method {
						case "POST":
							s.handleAuthCheckPostRequest([0]string{}, elemIsEscaped, w, r)
						default:
							s.notAllowed(w, r, "POST")
						}

						return
					}

					elem = origElem
				case 'r': // Prefix: "re"
					origElem := elem
					if l := len("re"); len(elem) >= l && elem[0:l] == "re" {
						elem = elem[l:]
					} else {
						break
					}

					if len(elem) == 0 {
						break
					}
					switch elem[0] {
					case 'g': // Prefix: "gister"
						origElem := elem
						if l := len("gister"); len(elem) >= l && elem[0:l] == "gister" {
							elem = elem[l:]
						} else {
							break
						}

						if len(elem) == 0 {
							switch r.Method {
							case "POST":
								s.handleAuthRegisterPostRequest([0]string{}, elemIsEscaped, w, r)
							default:
								s.notAllowed(w, r, "POST")
							}

							return
						}
						switch elem[0] {
						case '-': // Prefix: "-browser"
							origElem := elem
							if l := len("-browser"); len(elem) >= l && elem[0:l] == "-browser" {
								elem = elem[l:]
							} else {
								break
							}

							if len(elem) == 0 {
								// Leaf node.
								switch r.Method {
								case "POST":
									s.handleAuthRegisterBrowserPostRequest([0]string{}, elemIsEscaped, w, r)
								default:
									s.notAllowed(w, r, "POST")
								}

								return
							}

							elem = origElem
						}

						elem = origElem
					case 'v': // Prefix: "voke"
						origElem := elem
						if l := len("voke"); len(elem) >= l && elem[0:l] == "voke" {
							elem = elem[l:]
						} else {
							break
						}

						if len(elem) == 0 {
							switch r.Method {
							case "POST":
								s.handleAuthRevokePostRequest([0]string{}, elemIsEscaped, w, r)
							default:
								s.notAllowed(w, r, "POST")
							}

							return
						}
						switch elem[0] {
						case '-': // Prefix: "-browser"
							origElem := elem
							if l := len("-browser"); len(elem) >= l && elem[0:l] == "-browser" {
								elem = elem[l:]
							} else {
								break
							}

							if len(elem) == 0 {
								// Leaf node.
								switch r.Method {
								case "POST":
									s.handleAuthRevokeBrowserPostRequest([0]string{}, elemIsEscaped, w, r)
								default:
									s.notAllowed(w, r, "POST")
								}

								return
							}

							elem = origElem
						}

						elem = origElem
					}

					elem = origElem
				}

				elem = origElem
			case 'e': // Prefix: "elevation"
				origElem := elem
				if l := len("elevation"); len(elem) >= l && elem[0:l] == "elevation" {
					elem = elem[l:]
				} else {
					break
				}

				if len(elem) == 0 {
					// Leaf node.
					switch r.Method {
					case "POST":
						s.handleElevationPostRequest([0]string{}, elemIsEscaped, w, r)
					default:
						s.notAllowed(w, r, "POST")
					}

					return
				}

				elem = origElem
			case 'w': // Prefix: "weather/short-uk"
				origElem := elem
				if l := len("weather/short-uk"); len(elem) >= l && elem[0:l] == "weather/short-uk" {
					elem = elem[l:]
				} else {
					break
				}

				if len(elem) == 0 {
					// Leaf node.
					switch r.Method {
					case "GET":
						s.handleWeatherShortUkGetRequest([0]string{}, elemIsEscaped, w, r)
					default:
						s.notAllowed(w, r, "GET")
					}

					return
				}

				elem = origElem
			}

			elem = origElem
		}
	}
	s.notFound(w, r)
}

// Route is route object.
type Route struct {
	name        string
	summary     string
	operationID string
	pathPattern string
	count       int
	args        [0]string
}

// Name returns ogen operation name.
//
// It is guaranteed to be unique and not empty.
func (r Route) Name() string {
	return r.name
}

// Summary returns OpenAPI summary.
func (r Route) Summary() string {
	return r.summary
}

// OperationID returns OpenAPI operationId.
func (r Route) OperationID() string {
	return r.operationID
}

// PathPattern returns OpenAPI path.
func (r Route) PathPattern() string {
	return r.pathPattern
}

// Args returns parsed arguments.
func (r Route) Args() []string {
	return r.args[:r.count]
}

// FindRoute finds Route for given method and path.
//
// Note: this method does not unescape path or handle reserved characters in path properly. Use FindPath instead.
func (s *Server) FindRoute(method, path string) (Route, bool) {
	return s.FindPath(method, &url.URL{Path: path})
}

// FindPath finds Route for given method and URL.
func (s *Server) FindPath(method string, u *url.URL) (r Route, _ bool) {
	var (
		elem = u.Path
		args = r.args
	)
	if rawPath := u.RawPath; rawPath != "" {
		if normalized, ok := uri.NormalizeEscapedPath(rawPath); ok {
			elem = normalized
		}
		defer func() {
			for i, arg := range r.args[:r.count] {
				if unescaped, err := url.PathUnescape(arg); err == nil {
					r.args[i] = unescaped
				}
			}
		}()
	}

	elem, ok := s.cutPrefix(elem)
	if !ok {
		return r, false
	}

	// Static code generated router with unwrapped path search.
	switch {
	default:
		if len(elem) == 0 {
			break
		}
		switch elem[0] {
		case '/': // Prefix: "/"
			origElem := elem
			if l := len("/"); len(elem) >= l && elem[0:l] == "/" {
				elem = elem[l:]
			} else {
				break
			}

			if len(elem) == 0 {
				break
			}
			switch elem[0] {
			case 'a': // Prefix: "auth/"
				origElem := elem
				if l := len("auth/"); len(elem) >= l && elem[0:l] == "auth/" {
					elem = elem[l:]
				} else {
					break
				}

				if len(elem) == 0 {
					break
				}
				switch elem[0] {
				case 'a': // Prefix: "authenticate"
					origElem := elem
					if l := len("authenticate"); len(elem) >= l && elem[0:l] == "authenticate" {
						elem = elem[l:]
					} else {
						break
					}

					if len(elem) == 0 {
						switch method {
						case "POST":
							r.name = "AuthAuthenticatePost"
							r.summary = "Authenticate as a user (see /auth/authenticate-browser if you are the frontend)"
							r.operationID = ""
							r.pathPattern = "/auth/authenticate"
							r.args = args
							r.count = 0
							return r, true
						default:
							return
						}
					}
					switch elem[0] {
					case '-': // Prefix: "-browser"
						origElem := elem
						if l := len("-browser"); len(elem) >= l && elem[0:l] == "-browser" {
							elem = elem[l:]
						} else {
							break
						}

						if len(elem) == 0 {
							// Leaf node.
							switch method {
							case "POST":
								r.name = "AuthAuthenticateBrowserPost"
								r.summary = "Authenticate and store the token in the requesting browser's cookie jar"
								r.operationID = ""
								r.pathPattern = "/auth/authenticate-browser"
								r.args = args
								r.count = 0
								return r, true
							default:
								return
							}
						}

						elem = origElem
					}

					elem = origElem
				case 'c': // Prefix: "check"
					origElem := elem
					if l := len("check"); len(elem) >= l && elem[0:l] == "check" {
						elem = elem[l:]
					} else {
						break
					}

					if len(elem) == 0 {
						// Leaf node.
						switch method {
						case "POST":
							r.name = "AuthCheckPost"
							r.summary = "Check if you are authenticated"
							r.operationID = ""
							r.pathPattern = "/auth/check"
							r.args = args
							r.count = 0
							return r, true
						default:
							return
						}
					}

					elem = origElem
				case 'r': // Prefix: "re"
					origElem := elem
					if l := len("re"); len(elem) >= l && elem[0:l] == "re" {
						elem = elem[l:]
					} else {
						break
					}

					if len(elem) == 0 {
						break
					}
					switch elem[0] {
					case 'g': // Prefix: "gister"
						origElem := elem
						if l := len("gister"); len(elem) >= l && elem[0:l] == "gister" {
							elem = elem[l:]
						} else {
							break
						}

						if len(elem) == 0 {
							switch method {
							case "POST":
								r.name = "AuthRegisterPost"
								r.summary = "Register a new account"
								r.operationID = ""
								r.pathPattern = "/auth/register"
								r.args = args
								r.count = 0
								return r, true
							default:
								return
							}
						}
						switch elem[0] {
						case '-': // Prefix: "-browser"
							origElem := elem
							if l := len("-browser"); len(elem) >= l && elem[0:l] == "-browser" {
								elem = elem[l:]
							} else {
								break
							}

							if len(elem) == 0 {
								// Leaf node.
								switch method {
								case "POST":
									r.name = "AuthRegisterBrowserPost"
									r.summary = "Register a new account and store the token in the requesting browser's cookie jar"
									r.operationID = ""
									r.pathPattern = "/auth/register-browser"
									r.args = args
									r.count = 0
									return r, true
								default:
									return
								}
							}

							elem = origElem
						}

						elem = origElem
					case 'v': // Prefix: "voke"
						origElem := elem
						if l := len("voke"); len(elem) >= l && elem[0:l] == "voke" {
							elem = elem[l:]
						} else {
							break
						}

						if len(elem) == 0 {
							switch method {
							case "POST":
								r.name = "AuthRevokePost"
								r.summary = "Revoke a token"
								r.operationID = ""
								r.pathPattern = "/auth/revoke"
								r.args = args
								r.count = 0
								return r, true
							default:
								return
							}
						}
						switch elem[0] {
						case '-': // Prefix: "-browser"
							origElem := elem
							if l := len("-browser"); len(elem) >= l && elem[0:l] == "-browser" {
								elem = elem[l:]
							} else {
								break
							}

							if len(elem) == 0 {
								// Leaf node.
								switch method {
								case "POST":
									r.name = "AuthRevokeBrowserPost"
									r.summary = "Revoke the token stored in the requesting browser's cookie jar"
									r.operationID = ""
									r.pathPattern = "/auth/revoke-browser"
									r.args = args
									r.count = 0
									return r, true
								default:
									return
								}
							}

							elem = origElem
						}

						elem = origElem
					}

					elem = origElem
				}

				elem = origElem
			case 'e': // Prefix: "elevation"
				origElem := elem
				if l := len("elevation"); len(elem) >= l && elem[0:l] == "elevation" {
					elem = elem[l:]
				} else {
					break
				}

				if len(elem) == 0 {
					// Leaf node.
					switch method {
					case "POST":
						r.name = "ElevationPost"
						r.summary = "Lookup elevations for a list of coordinates"
						r.operationID = ""
						r.pathPattern = "/elevation"
						r.args = args
						r.count = 0
						return r, true
					default:
						return
					}
				}

				elem = origElem
			case 'w': // Prefix: "weather/short-uk"
				origElem := elem
				if l := len("weather/short-uk"); len(elem) >= l && elem[0:l] == "weather/short-uk" {
					elem = elem[l:]
				} else {
					break
				}

				if len(elem) == 0 {
					// Leaf node.
					switch method {
					case "GET":
						r.name = "WeatherShortUkGet"
						r.summary = "Find short format weather forecasts for a place in the UK"
						r.operationID = ""
						r.pathPattern = "/weather/short-uk"
						r.args = args
						r.count = 0
						return r, true
					default:
						return
					}
				}

				elem = origElem
			}

			elem = origElem
		}
	}
	return r, false
}