/**
 * Les PNG de src/assets sont importes comme modules binaires par Wrangler
 * (voir la regle [[rules]] type = "Data" dans wrangler.toml). Les remplacer
 * revient a deposer d'autres fichiers du meme nom.
 */
declare module "*.png" {
  const content: ArrayBuffer;
  export default content;
}

declare module "*.woff2" {
  const content: ArrayBuffer;
  export default content;
}
