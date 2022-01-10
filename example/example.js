import { ICC } from "../iCC.js";

const icc = ICC.parse(await Deno.readFile("png.icc"));
console.log(icc);
