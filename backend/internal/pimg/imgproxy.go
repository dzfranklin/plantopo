package pimg

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strings"
)

/*
var keyBin, saltBin []byte
	var err error

	if keyBin, err = hex.DecodeString(key); err != nil {
		log.Fatal(err)
	}

	if saltBin, err = hex.DecodeString(salt); err != nil {
		log.Fatal(err)
	}

	path := "/rs:fit:300:300/plain/http://img.example.com/pretty/image.jpg"

	mac := hmac.New(sha256.New, keyBin)
	mac.Write(saltBin)
	mac.Write([]byte(path))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	fmt.Printf("/%s%s", signature, path)
*/

const imgproxyHost = "imagecdn.plantopo.com"

var imgproxyB64 = base64.StdEncoding.WithPadding(base64.NoPadding)

func imgproxyPath(key, salt []byte, source string, opts [][]string, ext string) string {
	// http://imgproxy.example.com/%signature/%processing_options/plain/%source_url@%extension
	var path strings.Builder

	_, _ = path.WriteString("/")

	for _, args := range opts {
		for i, arg := range args {
			if i != 0 {
				_, _ = path.WriteString(":")
			}
			_, _ = path.WriteString(arg)
		}
		_, _ = path.WriteString("/")
	}

	_, _ = path.WriteString(imgproxyB64.EncodeToString([]byte(source)))

	_, _ = path.WriteString(".")
	_, _ = path.WriteString(ext)

	return imgproxySignedURL(key, salt, imgproxyHost, path.String())
}

func imgproxySignedURL(key, salt []byte, host, path string) string {
	mac := hmac.New(sha256.New, key)
	mac.Write(salt)
	mac.Write([]byte(path))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return "https://" + host + "/" + signature + path
}
