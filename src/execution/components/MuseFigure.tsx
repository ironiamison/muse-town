import { useId } from "react";

export default function MuseFigure({
  size = "small",
  label = "Muse",
}: {
  size?: "small" | "large";
  label?: string;
}) {
  const textureId = useId();

  return (
    <span className={`muse-figure muse-figure--${size}`} role="img" aria-label={label}>
      <svg viewBox="0 0 320 410" aria-hidden="true">
        <defs>
          <filter id={textureId} x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency=".42" numOctaves="2" seed="11" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
            <feComponentTransfer in="mono" result="faintNoise">
              <feFuncA type="table" tableValues="0 .13" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="faintNoise" mode="multiply" />
          </filter>
        </defs>
        <g className="muse-figure__character" filter={`url(#${textureId})`}>
          <path
            className="muse-figure__shell"
            d="M160 18C105 18 66 47 49 101C34 149 25 246 34 317C42 374 88 397 160 397C232 397 278 374 286 317C295 246 286 149 271 101C254 47 215 18 160 18Z"
          />
          <path className="muse-figure__arm" d="M62 220C76 201 105 194 130 207C144 214 145 231 132 240C111 254 95 281 68 284" />
          <path className="muse-figure__arm" d="M258 220C244 201 215 194 190 207C176 214 175 231 188 240C209 254 225 281 252 284" />
          <path
            className="muse-figure__face"
            d="M79 86C99 56 221 56 241 86C255 107 257 168 240 188C218 214 102 214 80 188C63 168 65 107 79 86Z"
          />
          <g className="muse-figure__eyes">
            <ellipse cx="122" cy="132" rx="7" ry="9" />
            <ellipse cx="198" cy="132" rx="7" ry="9" />
          </g>
          <path className="muse-figure__mouth" d="M148 163C155 169 165 169 172 163" />
        </g>
      </svg>
      <span className="muse-figure__orbit"><i /><i /></span>
    </span>
  );
}
