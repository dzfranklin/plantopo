package pstrings

func TruncateASCII(v string, maxLen int) string {
	if len(v) > maxLen {
		return v[:maxLen-3] + "..."
	} else {
		return v
	}
}

func TruncateASCIIFromEnd(v string, maxLen int) string {
	if len(v) > maxLen {
		return "..." + v[len(v)-maxLen-3:]
	} else {
		return v
	}
}

func EmptyToNil(v string) *string {
	if v == "" {
		return nil
	} else {
		return &v
	}
}
