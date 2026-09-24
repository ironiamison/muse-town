export type PhysicalAsset = {
  id: string;
  src: string;
  alt: string;
  credit: string;
  source: string;
  kind: "vehicle" | "detail" | "interior" | "location";
  temporary: true;
};

function temporaryPhoto(
  id: string,
  src: string,
  alt: string,
  credit: string,
  source: string,
  kind: PhysicalAsset["kind"],
): PhysicalAsset {
  return {
    id,
    src,
    alt,
    credit,
    source,
    kind,
    temporary: true,
  };
}

/**
 * Centralized temporary physical-world photography.
 *
 * All images are local, compressed copies of real photographs published for
 * free use under the Pexels license. Replace this one collection with
 * commissioned production imagery; no route embeds a third-party image URL.
 */
export const PHYSICAL_ASSETS = {
  heroVehicle: temporaryPhoto(
    "porsche-front",
    "/physical/hero-vehicle.jpg",
    "Porsche 911 headlight and front bodywork",
    "Bradikan / Pexels",
    "https://www.pexels.com/photo/30806883",
    "vehicle",
  ),
  dealership: temporaryPhoto(
    "garage-inspection",
    "/physical/dealership.jpg",
    "Mechanic inspecting a vehicle in a specialist garage",
    "Dextar Studio / Pexels",
    "https://www.pexels.com/photo/mechanic-working-on-luxury-car-in-modern-garage-36281956",
    "location",
  ),
  roadVehicle: temporaryPhoto(
    "porsche-wheel",
    "/physical/road-vehicle.jpg",
    "Porsche 911 wheel, brake, and front bodywork",
    "Bradikan / Pexels",
    "https://www.pexels.com/photo/30806921",
    "vehicle",
  ),
  interior: temporaryPhoto(
    "executor-garage",
    "/physical/interior.jpg",
    "A vehicle executor preparing tools inside a garage",
    "Artem Podrez / Pexels",
    "https://www.pexels.com/photo/a-photo-of-the-mechanic-from-the-car-interior-8985453",
    "interior",
  ),
  dashboard: temporaryPhoto(
    "vehicle-controls",
    "/physical/dashboard.jpg",
    "Close-up of a vehicle control system",
    "Ana Frontzek / Pexels",
    "https://www.pexels.com/photo/porsche-taycan-e-911-carrera-27727842",
    "interior",
  ),
  emblem: temporaryPhoto(
    "engine-inspection",
    "/physical/detail.jpg",
    "Gloved hand checking a vehicle engine",
    "Fatih Erden / Pexels",
    "https://www.pexels.com/photo/a-mechanic-opening-the-oil-filler-cap-of-a-car-engine-10490621",
    "detail",
  ),
  apartmentInspection: temporaryPhoto(
    "apartment-measurement",
    "/physical/apartment-inspection.jpg",
    "A physical apartment measurement being taken with a tape measure",
    "Ksenia Chernaya / Pexels",
    "https://www.pexels.com/photo/crop-man-measuring-wall-at-home-5691675",
    "detail",
  ),
  storeInventory: temporaryPhoto(
    "store-inventory",
    "/physical/store-inventory.jpg",
    "Retail shelves photographed from above during an inventory check",
    "Pixabay / Pexels",
    "https://www.pexels.com/photo/assorted-item-lot-264507",
    "location",
  ),
  packageDelivery: temporaryPhoto(
    "package-handover",
    "/physical/package-delivery.jpg",
    "A package being handed directly to its recipient",
    "Kindel Media / Pexels",
    "https://www.pexels.com/photo/hands-work-box-service-6868621",
    "detail",
  ),
} as const;
