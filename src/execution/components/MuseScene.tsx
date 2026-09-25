type MuseSceneProps = {
  src: string;
  alt: string;
  eyebrow: string;
  caption: string;
  wide?: boolean;
};

export default function MuseScene({
  src,
  alt,
  eyebrow,
  caption,
  wide = false,
}: MuseSceneProps) {
  return (
    <figure className={`ms-muse-scene${wide ? " ms-muse-scene--wide" : ""}`}>
      <img src={src} alt={alt} loading={wide ? "eager" : "lazy"} />
      <figcaption>
        <span>{eyebrow}</span>
        <strong>{caption}</strong>
      </figcaption>
    </figure>
  );
}
