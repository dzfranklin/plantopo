package pgeograph

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"strconv"
)

type Image struct {
	Src    string
	Width  int
	Height int
}

/* From email with geograph
$size = largest($row['original_width'],$row['original_height']);
if ($size == 1024) {
	$url = getGeographUrl($id, $hash, "_original"); //if largest is 1024 anyway, we dont bother creating a another copy
} elseif ($size > 1024) {
	$url = getGeographUrl($id, $hash, " _1024x1024");
} else { //only the nominal 640px version available (may be smaller in practice!)
	$url = getGeographUrl($id, $hash, ""); //no suffix
}
*/

func originalImage(secret []byte, meta gridimage) Image {
	if meta.OriginalWidth != 0 && meta.OriginalHeight != 0 {
		return Image{Width: meta.OriginalWidth, Height: meta.OriginalHeight, Src: imageVariant(secret, meta, "_original")}
	} else {
		return smallImage(secret, meta)
	}
}

func smallImage(secret []byte, meta gridimage) Image {
	if meta.Width == 0 || meta.Height == 0 {
		return Image{}
	}
	return Image{Width: meta.Width, Height: meta.Height, Src: imageVariant(secret, meta, "")}
}

func imageVariant(secret []byte, meta gridimage, variant string) string {
	/* <https://github.com/geograph-project/geograph-project/blob/83ec6782fc81174480c6386c6ede90b0a0411d95/libs/geograph/gridimage.class.php#L677>
	$ab=sprintf("%02d", floor(($this->gridimage_id%1000000)/10000));
	$cd=sprintf("%02d", floor(($this->gridimage_id%10000)/100));
	$abcdef=sprintf("%06d", $this->gridimage_id);
	$hash=$this->_getAntiLeechHash();
	if ($this->gridimage_id<1000000) {
		$fullpath="/photos/$ab/$cd/{$abcdef}_{$hash}.jpg";
	} else {
		$yz=sprintf("%02d", floor($this->gridimage_id/1000000));
		$fullpath="/geophotos/$yz/$ab/$cd/{$abcdef}_{$hash}.jpg";
	}
	*/
	host := "https://s0.geograph.org.uk"
	id := meta.GridimageID
	hash := computeImageHash(secret, id, meta.UserID)
	if id < 1000000 {
		return fmt.Sprintf("%s/photos/%02d/%02d/%06d_%s%s.jpg",
			host, id%1000000/10000, id%10000/100, id, hash, variant)
	} else {
		return fmt.Sprintf("%s/geophotos/%02d/%02d/%02d/%06d_%s%s.jpg",
			host, id/1000000, id%1000000/10000, id%10000/100, id, hash, variant)
	}
}

func computeImageHash(secret []byte, id int, userID int) string {
	/*  <https://github.com/geograph-project/geograph-project/blob/83ec6782fc81174480c6386c6ede90b0a0411d95/libs/geograph/gridimage.class.php#L445>
	substr(md5($this->gridimage_id.$this->user_id.$CONF['photo_hashing_secret']), 0, 8)
	*/
	var input bytes.Buffer
	input.Write([]byte(strconv.FormatInt(int64(id), 10)))
	input.Write([]byte(strconv.FormatInt(int64(userID), 10)))
	input.Write(secret)
	hash := md5.Sum(input.Bytes())
	return hex.EncodeToString(hash[:])[:8]
}
