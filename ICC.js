import { Buffer } from "https://taisukef.github.io/buffer/Buffer.js";

// http://www.color.org/profileheader.xalter

const versionMap = {
  0x02000000: '2.0',
  0x02100000: '2.1',
  0x02400000: '2.4',
  0x04000000: '4.0',
  0x04200000: '4.2',
  0x04300000: '4.3',
};

const intentMap = {
  0: 'Perceptual',
  1: 'Relative',
  2: 'Saturation',
  3: 'Absolute',
};

const valueMap = {
  // Device
  scnr: 'Scanner',
  mntr: 'Monitor',
  prtr: 'Printer',
  link: 'Link',
  abst: 'Abstract',
  spac: 'Space',
  nmcl: 'Named color',
  // Platform
  appl: 'Apple',
  adbe: 'Adobe',
  msft: 'Microsoft',
  sunw: 'Sun Microsystems',
  sgi: 'Silicon Graphics',
  tgnt: 'Taligent',
};

const tagMap = {
  desc: 'description',
  cprt: 'copyright',
  dmdd: 'deviceModelDescription',
  vued: 'viewingConditionsDescription',
  vued: 'viewingConditionsDescription',
  wtpt: 'whitepoint',
  kTRC: 'grayToneReproductionCurve',
};

const getContentAtOffsetAsString = (buffer, offset) => {
  const value = buffer.slice(offset, offset + 4).toString().trim();
  return (value.toLowerCase() in valueMap) ? valueMap[value.toLowerCase()] : value;
};

const hasContentAtOffset = (buffer, offset) => buffer.readUInt32BE(offset) !== 0;

const readStringUTF16BE = (buffer, start, end) => {
  const data = buffer.slice(start, end);
  let value = '';
  for (let i = 0; i < data.length; i += 2) {
    value += String.fromCharCode((data[i] * 256) + data[i + 1]);
  }
  return value;
};

const invalid = (reason) => new Error(`Invalid ICC profile: ${reason}`);

const parse = (bin) => {
  const buffer = new Buffer(bin);
  // Verify expected length
  const size = buffer.readUInt32BE(0);
  if (size !== buffer.length) {
    throw invalid('length mismatch');
  }
  // Verify 'acsp' signature
  const signature = buffer.slice(36, 40).toString();
  if (signature !== 'acsp') {
    throw invalid('missing signature');
  }
  // Integer attributes
  const profile = {
    version: versionMap[buffer.readUInt32BE(8)],
    intent: intentMap[buffer.readUInt32BE(64)]
  };
  // Four-byte string attributes
  [
    [4, 'cmm'],
    [12, 'deviceClass'],
    [16, 'colorSpace'],
    [20, 'connectionSpace'],
    [40, 'platform'],
    [48, 'manufacturer'],
    [52, 'model'],
    [80, 'creator'],
  ].forEach(attr => {
    if (hasContentAtOffset(buffer, attr[0])) {
      profile[attr[1]] = getContentAtOffsetAsString(buffer, attr[0]);
    }
  });
  // Tags
  const tagCount = buffer.readUInt32BE(128);
  let tagHeaderOffset = 132;
  for (let i = 0; i < tagCount; i++) {
    const tagSignature = getContentAtOffsetAsString(buffer, tagHeaderOffset);
    if (tagSignature in tagMap) {
      const tagOffset = buffer.readUInt32BE(tagHeaderOffset + 4);
      const tagSize = buffer.readUInt32BE(tagHeaderOffset + 8);
      if (tagOffset > buffer.length) {
        throw invalid('tag offset out of bounds');
      }
      const tagType = getContentAtOffsetAsString(buffer, tagOffset);
      if (tagType === 'desc') {
        const tagValueSize = buffer.readUInt32BE(tagOffset + 8);
        if (tagValueSize > tagSize) {
          throw invalid(`description tag value size out of bounds for ${tagSignature}`);
        }
        profile[tagMap[tagSignature]] = buffer.slice(tagOffset + 12, tagOffset + tagValueSize + 11).toString();
      } else if (tagType === 'text') {
        profile[tagMap[tagSignature]] = buffer.slice(tagOffset + 8, tagOffset + tagSize - 7).toString();
      } else if (tagType === 'mluc' && tagSignature in tagMap) {
        // 4 bytes signature, 4 bytes reserved (must be 0), 4 bytes number of names, 4 bytes name record size (must be 12)
        const numberOfNames = buffer.readUInt32BE(tagOffset + 8);
        const nameRecordSize = buffer.readUInt32BE(tagOffset + 12);
        if (nameRecordSize !== 12) {
          throw invalid(`mluc name record size must be 12 for tag ${tagSignature}`);
        }
        if (numberOfNames > 0) {
          // Entry: 2 bytes language code, 2 bytes country code, 4 bytes length, 4 bytes offset from start of tag
          // const languageCode = buffer.slice(tagOffset + 16, tagOffset + 18).toString();
          // const countryCode = buffer.slice(tagOffset + 18, tagOffset + 20).toString();
          const nameLength = buffer.readUInt32BE(tagOffset + 20);
          const nameOffset = buffer.readUInt32BE(tagOffset + 24);
          const nameStart = tagOffset + nameOffset;
          const nameStop = nameStart + nameLength;
          profile[tagMap[tagSignature]] = readStringUTF16BE(buffer, nameStart, nameStop);
        }
      } else if (tagType === 'curv') {
        const entryCount = buffer.readUInt32BE(tagOffset + 8);
        const entries = [];
        if (12 + 2 * entryCount > tagSize) {
          throw new Error('Invalid ICC profile: Curve tag value size out of bounds for ' + tagSignature);
        }
        for (let i = 0; i < entryCount; i++) {
          entries.push(buffer.readUInt16BE(tagOffset + 12 + 2 * i));
        }
        profile[tagMap[tagSignature]] = entries;
      } else if (tagType === 'XYZ') {
        profile[tagMap[tagSignature]] = [
          buffer.readInt16BE(tagOffset + 8),
          buffer.readInt16BE(tagOffset + 12),
          buffer.readInt16BE(tagOffset + 16)
        ];
      }
    }
    tagHeaderOffset = tagHeaderOffset + 12;
  }
  return profile;
};

const ICC = { parse };

export { ICC };
