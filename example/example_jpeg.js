import { parseICCFromJPEG } from "../parseICCFromJPEG.js";
import { ICC } from "../ICC.js";

//const fn = "stress.jpg";
const fn = "displayp3.jpg";
//const fn = "rgb.jpg"; // no icc
//const fn = "IMG_3508.jpg";
//const fn = "DJI_0163.JPG"; // no icc
const bin = await Deno.readFile(fn);
const icc = parseICCFromJPEG(bin);
if (!icc) {
  throw "has no ICC Profile";
}
await Deno.writeFile(fn + ".icc", icc);
console.log(icc);
console.log(ICC.parse(icc));
