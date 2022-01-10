const debug = false;

export const parseICCFromJPEG = (bin) => {
  const file = bin instanceof Uint8Array ? bin.buffer : bin;
  const dataView = new DataView(file);

  if (debug) {
    console.log("Got file of length " + file.byteLength);
  }
  if ((dataView.getUint8(0) != 0xFF) || (dataView.getUint8(1) != 0xD8)) {
    if (debug) {
      console.log("Not a valid JPEG");
    }
    return false; // not a valid jpeg
  }

  let offset = 2;
  const length = file.byteLength;

  while (offset < length) {
    if (dataView.getUint8(offset) != 0xFF) {
      if (debug) {
        console.log("Not a valid marker at offset " + offset + ", found: " + dataView.getUint8(offset));
      }
      return null; // not a valid marker, something is wrong
    }

    const marker = dataView.getUint8(offset + 1);
    const len = dataView.getUint16(offset + 2);
    //console.log(marker.toString(16), marker, len)

    if (marker == 0xe1) { // EXIF
      //const exif = readEXIFData(dataView, offset + 4, dataView.getUint16(offset + 2) - 2);
      //console.log({exif});
    } else if (marker == 0xe2) { // colorspace ... can't decode
      // e2 226 4104
      // startsWith ICC_PROFILE\0 (.len = 12) + 1 1
      const iccoffset = 12 + 4 + 2;
      const icclen = len - iccoffset + 2;
      const buf = new Uint8Array(icclen);
      for (let i = 0; i < icclen; i++) {
        buf[i] = dataView.getUint8(offset + i + iccoffset);
      }
      return buf;
    }
    offset += 2 + len;
  }
  return null;
};
