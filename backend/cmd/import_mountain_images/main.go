package main

import (
	"flag"
	"os"
)

func main() {
	downloadFlag := flag.Bool("download", false, "")
	importFlag := flag.String("import", "", "-import <file>")
	flag.Parse()

	if *downloadFlag {
		doDownload()
	} else if *importFlag != "" {
		doImport(*importFlag)
	} else {
		flag.Usage()
		os.Exit(1)
	}

	// TODO: manually fix missing ids
	//
	// TODO: Import flag that imports into table (which is then joined by the dboih
	//   repo) Cleans up source into source_url (optional) and source_text
	//
	// TODO: put cloudfront in from of imgproxy. behind that I think we can just request directly from wikimedia?
}
