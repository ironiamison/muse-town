export type MotionAsset = {
  src: string;
  poster: string;
  credit: string;
  source: string;
};

export const MOTION_ASSETS = {
  executionFilm: {
    src: "/execution-film.mp4",
    poster: "/execution-film-poster.jpg",
    credit: "Artem Podrez / Pexels",
    source: "https://www.pexels.com/video/a-man-inspecting-a-car-engine-8987286",
  },
  dispatch: {
    src: "/dispatch-loop.mp4",
    poster: "/dispatch-loop-poster.jpg",
    credit: "Artem Podrez / Pexels",
    source: "https://www.pexels.com/video/mechanic-using-his-smartphone-8987300",
  },
  onsite: {
    src: "/onsite-loop.mp4",
    poster: "/onsite-loop-poster.jpg",
    credit: "Anastasia Shuraeva / Pexels",
    source: "https://www.pexels.com/video/mechanic-checking-under-the-car-8470382",
  },
  proof: {
    src: "/proof-loop.mp4",
    poster: "/proof-loop-poster.jpg",
    credit: "Artem Podrez / Pexels",
    source: "https://www.pexels.com/video/a-man-inspecting-a-car-engine-8987286",
  },
} as const satisfies Record<string, MotionAsset>;
