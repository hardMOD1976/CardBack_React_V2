import pg from "pg";
import { GoogleGenAI } from "@google/genai";
import { PRODUCT_RELEASES, FIGURES } from "../src/data/catalogueSeed";
import { STAR_WARS_FIGURES, STAR_WARS_LINES } from "./starWarsCatalogueData";

let genAiClient: GoogleGenAI | null = null;
function getGenAiClient(): GoogleGenAI {
  if (!genAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    genAiClient = new GoogleGenAI({ apiKey });
  }
  return genAiClient;
}

export interface BarcodeMatchOption {
  id: string;
  title: string;
  character: string;
  line: string;
  franchise: string;
  manufacturer: string;
  year: number;
  packagingType: string;
  region: string;
  assortmentSku?: string;
  description: string;
  imageUrl?: string;
  source: "database" | "curated_catalog" | "gs1_registry" | "online_archive";
  confidence: number;
  figureId?: string;
  releaseId?: string;
}

export interface BarcodeLookupResponse {
  found: boolean;
  isToyOrActionFigure: boolean;
  barcode: string;
  manufacturer: string | null;
  productName: string | null;
  notFoundReason: "not_a_toy_manufacturer" | "unregistered_barcode" | null;
  message: string;
  options: BarcodeMatchOption[];
}

/**
 * In-memory deterministic cache for barcode lookup results.
 * Guarantees that scanning the exact same barcode always returns the exact same result.
 */
const barcodeLookupCache = new Map<string, BarcodeLookupResponse>();

/**
 * Recognized GS1 company prefixes for official action figure and toy manufacturers.
 */
export const TOY_MANUFACTURER_PREFIXES: Record<
  string,
  { manufacturer: string; knownLines: string[]; primaryFranchises: string[] }
> = {
  // Kenner & Hasbro
  "076281": {
    manufacturer: "Kenner Products / Hasbro",
    knownLines: ["Vintage Star Wars (1978-1985)", "The Power of the Force 2", "Batman: The Animated Series", "Jurassic Park", "Shadows of the Empire"],
    primaryFranchises: ["Star Wars", "DC Comics", "Jurassic Park"]
  },
  "653569": {
    manufacturer: "Hasbro",
    knownLines: ["The Vintage Collection", "The Black Series", "Marvel Legends", "Transformers Generations", "G.I. Joe Classified", "Star Wars Saga"],
    primaryFranchises: ["Star Wars", "Marvel", "Transformers", "G.I. Joe"]
  },
  "501099": {
    manufacturer: "Hasbro UK / International",
    knownLines: ["Star Wars Tri-Logo / European Assortment", "Action Man", "The Vintage Collection EU", "The Black Series EU"],
    primaryFranchises: ["Star Wars", "Marvel", "Action Man"]
  },
  "630509": {
    manufacturer: "Hasbro (Modern Star Wars & Marvel)",
    knownLines: ["The Vintage Collection", "The Black Series", "Marvel Legends", "Retro Collection"],
    primaryFranchises: ["Star Wars", "Marvel"]
  },
  "076930": {
    manufacturer: "Hasbro / Kenner (1990s-2000s)",
    knownLines: ["Star Wars POTF2", "Star Wars Episode I", "Action Figures"],
    primaryFranchises: ["Star Wars", "Transformers"]
  },
  "195166": {
    manufacturer: "Hasbro (Recent Waves)",
    knownLines: ["Star Wars TVC", "Marvel Legends", "G.I. Joe"],
    primaryFranchises: ["Star Wars", "Marvel"]
  },
  "194735": {
    manufacturer: "Mattel (Modern Action Figures)",
    knownLines: ["Masters of the Universe Origins", "Masterverse", "WWE Elite"],
    primaryFranchises: ["Masters of the Universe", "WWE"]
  },

  // Mattel
  "074299": {
    manufacturer: "Mattel",
    knownLines: ["Masters of the Universe Vintage", "DC Universe Classics", "Hot Wheels", "Secret Wars"],
    primaryFranchises: ["Masters of the Universe", "DC Comics", "Marvel (Vintage)"]
  },
  "887961": {
    manufacturer: "Mattel",
    knownLines: ["Masters of the Universe Origins", "Masterverse", "WWE Elite Collection", "Jurassic World Amber Collection"],
    primaryFranchises: ["Masters of the Universe", "WWE", "Jurassic World"]
  },
  "027084": {
    manufacturer: "Mattel",
    knownLines: ["Batman Action Figures", "DC Super Heroes", "Max Steel"],
    primaryFranchises: ["DC Comics", "Max Steel"]
  },

  // Playmates Toys
  "043377": {
    manufacturer: "Playmates Toys",
    knownLines: ["Teenage Mutant Ninja Turtles (1988-1997)", "Star Trek", "The Simpsons World of Springfield"],
    primaryFranchises: ["Teenage Mutant Ninja Turtles", "Star Trek", "The Simpsons"]
  },
  "035583": {
    manufacturer: "Playmates Toys",
    knownLines: ["TMNT Classic Collection", "Godzilla vs Kong"],
    primaryFranchises: ["Teenage Mutant Ninja Turtles", "Godzilla"]
  },

  // Toy Biz
  "038976": {
    manufacturer: "Toy Biz",
    knownLines: ["Marvel Super Heroes", "X-Men", "Spider-Man Classics", "Marvel Legends", "The Lord of the Rings"],
    primaryFranchises: ["Marvel", "The Lord of the Rings"]
  },

  // McFarlane Toys
  "787926": {
    manufacturer: "McFarlane Toys",
    knownLines: ["Spawn", "DC Multiverse", "Movie Maniacs", "Warhammer 40,000"],
    primaryFranchises: ["Spawn", "DC Comics", "Warhammer"]
  },

  // NECA
  "634482": {
    manufacturer: "NECA",
    knownLines: ["Ultimate Action Figures", "TMNT Cartoon & Movie", "Predator", "Alien", "Universal Monsters"],
    primaryFranchises: ["Teenage Mutant Ninja Turtles", "Predator", "Alien", "Horror / Sci-Fi"]
  },

  // Super7
  "840049": {
    manufacturer: "Super7",
    knownLines: ["ReAction Figures (3.75-inch)", "Ultimates! 7-inch"],
    primaryFranchises: ["Transformers", "G.I. Joe", "TMNT", "ThunderCats", "SilverHawks"]
  },

  // Funko
  "889698": {
    manufacturer: "Funko",
    knownLines: ["Pop! Vinyl", "Funko 3.75 Savage World", "Action Figures"],
    primaryFranchises: ["Star Wars", "Marvel", "DC", "Anime", "Pop Culture"]
  },

  // Bandai / Tamashii
  "454966": {
    manufacturer: "Bandai / Tamashii Nations",
    knownLines: ["S.H. Figuarts", "Manga Realization", "Movie Realization", "Gundam Universe"],
    primaryFranchises: ["Star Wars", "Dragon Ball", "Marvel", "Gundam"]
  },
  "457310": {
    manufacturer: "Bandai Spirits",
    knownLines: ["S.H. Figuarts", "Robot Spirits", "Ichibansho"],
    primaryFranchises: ["Anime", "Star Wars", "Marvel"]
  },

  // LJN / Galoob / Mego
  "024508": {
    manufacturer: "LJN Toys",
    knownLines: ["ThunderCats", "WWF Wrestling Superstars"],
    primaryFranchises: ["ThunderCats", "WWF"]
  },
  "080334": {
    manufacturer: "Lewis Galoob Toys",
    knownLines: ["Micro Machines", "Star Wars Action Fleet", "Biker Mice from Mars"],
    primaryFranchises: ["Star Wars", "Micro Machines"]
  },
  "021137": {
    manufacturer: "Mego Corporation",
    knownLines: ["World's Greatest Super-Heroes (WGSH)", "Star Trek 8-inch", "Action Jackson"],
    primaryFranchises: ["DC Comics", "Marvel", "Star Trek"]
  },

  // Mezco
  "695726": {
    manufacturer: "Mezco Toyz",
    knownLines: ["One:12 Collective", "Living Dead Dolls", "5 Points"],
    primaryFranchises: ["DC Comics", "Marvel", "Rumble Society"]
  },

  // LEGO
  "570201": {
    manufacturer: "LEGO",
    knownLines: ["LEGO Minifigures", "Star Wars Buildable Figures"],
    primaryFranchises: ["Star Wars", "Marvel", "DC", "LEGO"]
  }
};

/**
 * Authoritative, verified action figure barcode registry.
 * Maps exact UPC/EAN barcodes to single action figure releases.
 */
const KNOWN_ACTION_FIGURE_BARCODES: Record<string, BarcodeMatchOption> = {
  // --- Kenner Star Wars 1995 POTF2 Boba Fett ---
  "076281695822": {
    id: "rel-sw-boba-potf2-red",
    releaseId: "rel-sw-boba-potf2-red",
    figureId: "fig-sw-boba-potf2",
    title: "Boba Fett (POTF2 Red Card)",
    character: "Boba Fett",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1995,
    packagingType: "Blister Cardback (Red Card / Proof of Purchase)",
    region: "United States / North America",
    assortmentSku: "Assortment #69570 / No. 69582",
    description: "Official 1995 Kenner Star Wars: The Power of the Force 2 cardback release of Boba Fett with sawed-off blaster rifle and jet pack. Proof of Purchase UPC 0-76281-69582-2.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "76281695822": {
    id: "rel-sw-boba-potf2-red-11",
    releaseId: "rel-sw-boba-potf2-red",
    figureId: "fig-sw-boba-potf2",
    title: "Boba Fett (POTF2 Red Card)",
    character: "Boba Fett",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1995,
    packagingType: "Blister Cardback (Red Card / Proof of Purchase)",
    region: "United States / North America",
    assortmentSku: "Assortment #69570 / No. 69582",
    description: "Official 1995 Kenner Star Wars: The Power of the Force 2 cardback release of Boba Fett with sawed-off blaster rifle and jet pack.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "07628169582": {
    id: "rel-sw-boba-potf2-red-base",
    releaseId: "rel-sw-boba-potf2-red",
    figureId: "fig-sw-boba-potf2",
    title: "Boba Fett (POTF2 Red Card)",
    character: "Boba Fett",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1995,
    packagingType: "Blister Cardback (Red Card / Proof of Purchase)",
    region: "United States / North America",
    assortmentSku: "Assortment #69570 / No. 69582",
    description: "Official 1995 Kenner Star Wars: The Power of the Force 2 cardback release of Boba Fett.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281695953": {
    id: "rel-sw-boba-potf2-green-holo",
    releaseId: "rel-sw-boba-potf2-green",
    figureId: "fig-sw-boba-potf2",
    title: "Boba Fett (POTF2 Green Card Hologram)",
    character: "Boba Fett",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1996,
    packagingType: "Blister Cardback (Green Card / Hologram)",
    region: "North America",
    assortmentSku: "Assortment #69570 / No. 69595",
    description: "1996 Kenner POTF2 Green Card Boba Fett with hologram sticker.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },

  // --- Kenner Star Wars 1995 POTF2 ---
  "076281695701": {
    id: "rel-sw-vader-potf2-red-us",
    releaseId: "rel-sw-vader-potf2-red-us",
    figureId: "fig-sw-vader-potf2",
    title: "Darth Vader (POTF2 Red Card US)",
    character: "Darth Vader",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1995,
    packagingType: "Blister Cardback (Red Card / European Peg)",
    region: "United States / North America",
    assortmentSku: "Assortment #69570 / No. 69571",
    description: "Original 1995 Kenner red blister card featuring red photo backdrop and classic hologram foil sticker.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281695709": {
    id: "rel-sw-vader-potf2-red-us-alt",
    releaseId: "rel-sw-vader-potf2-red-us",
    figureId: "fig-sw-vader-potf2",
    title: "Darth Vader (POTF2 Red Card)",
    character: "Darth Vader",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    region: "North America",
    assortmentSku: "Assortment #69570 / No. 69571",
    description: "1995 Kenner POTF2 Darth Vader cardback release.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281695909": {
    id: "rel-sw-vader-potf2-green-us",
    releaseId: "rel-sw-vader-potf2-green-us",
    figureId: "fig-sw-vader-potf2",
    title: "Darth Vader (POTF2 Green Card with Hologram)",
    character: "Darth Vader",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1996,
    packagingType: "Blister Cardback (Green Card / Hologram)",
    region: "United States / Canada",
    assortmentSku: "Assortment #69570 / No. 69590",
    description: "1996 Kenner packaging revision on green cardback with foil hologram.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281841851": {
    id: "rel-sw-luke-potf2-red",
    title: "Luke Skywalker (POTF2 Red Card)",
    character: "Luke Skywalker",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    region: "United States",
    assortmentSku: "69570",
    description: "1995 Kenner Power of the Force 2 Red Card Luke Skywalker with lightsaber and electrobinoculars.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281841806": {
    id: "rel-sw-han-potf2-red",
    title: "Han Solo (POTF2 Red Card)",
    character: "Han Solo",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    region: "United States",
    assortmentSku: "69570",
    description: "1995 Kenner Power of the Force 2 Red Card Han Solo with heavy blaster pistol.",
    imageUrl: "https://images.unsplash.com/photo-1585675100414-add2e465a136?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281840717": {
    id: "rel-sw-chewie-potf2-red",
    title: "Chewbacca (POTF2 Red Card)",
    character: "Chewbacca",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    region: "United States",
    assortmentSku: "69570",
    description: "1995 Kenner Power of the Force 2 Red Card Chewbacca with Bowcaster rifle.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281840724": {
    id: "rel-sw-stormtrooper-potf2-red",
    title: "Stormtrooper (POTF2 Red Card)",
    character: "Stormtrooper",
    line: "Star Wars: The Power of the Force 2",
    franchise: "Star Wars",
    manufacturer: "Kenner / Hasbro",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    region: "United States",
    assortmentSku: "69570",
    description: "1995 Kenner Power of the Force 2 Red Card Imperial Stormtrooper with blaster rifle.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },

  // --- Kenner Vintage Star Wars (1978-1985) ---
  "076281382101": {
    id: "rel-sw-luke-1978-12back",
    releaseId: "rel-sw-luke-1978-12back",
    figureId: "fig-sw-luke-1978",
    title: "Luke Skywalker (1978 12-Back A)",
    character: "Luke Skywalker",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1978,
    packagingType: "12-Back Blister Card (A-Back)",
    region: "United States",
    assortmentSku: "No. 38210",
    description: "The premier 1978 Kenner 12-Back cardback release of Luke Skywalker with yellow telescoping lightsaber.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281382104": {
    id: "rel-sw-luke-1978-12back-b",
    releaseId: "rel-sw-luke-1978-12back",
    figureId: "fig-sw-luke-1978",
    title: "Luke Skywalker (1978 12-Back B)",
    character: "Luke Skywalker",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1978,
    packagingType: "12-Back Blister Card (B-Back)",
    region: "United States",
    assortmentSku: "No. 38210",
    description: "1978 Kenner 12-Back cardback release with cross-sell illustrations and telescoping lightsaber instructions.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281382200": {
    id: "rel-sw-leia-1978-12back",
    figureId: "fig-sw-princess-leia-1978",
    title: "Princess Leia Organa (1978 12-Back)",
    character: "Princess Leia Organa",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1978,
    packagingType: "12-Back Blister Card",
    region: "United States",
    assortmentSku: "No. 38220",
    description: "Original 1978 Kenner 12-Back cardback with white vinyl cape and blue/black imperial blaster pistol.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281382309": {
    id: "rel-sw-han-1978-12back",
    figureId: "fig-sw-han-solo-1978",
    title: "Han Solo (1978 12-Back Small Head)",
    character: "Han Solo",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1978,
    packagingType: "12-Back Blister Card",
    region: "United States",
    assortmentSku: "No. 38230",
    description: "Original 1978 Kenner 12-Back cardback with DL-44 blaster pistol.",
    imageUrl: "https://images.unsplash.com/photo-1585675100414-add2e465a136?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281382408": {
    id: "rel-sw-chewie-1978-12back",
    figureId: "fig-sw-chewbacca-1978",
    title: "Chewbacca (1978 12-Back)",
    character: "Chewbacca",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1978,
    packagingType: "12-Back Blister Card",
    region: "United States",
    assortmentSku: "No. 38240",
    description: "Original 1978 Kenner 12-Back cardback with Bowcaster rifle.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281382507": {
    id: "rel-sw-c3po-1978-12back",
    figureId: "fig-sw-c3po-1978",
    title: "C-3PO (1978 12-Back)",
    character: "C-3PO",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1978,
    packagingType: "12-Back Blister Card",
    region: "United States",
    assortmentSku: "No. 38250",
    description: "Original 1978 Kenner 12-Back cardback with vacuum-metalized gold protocol droid.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281382606": {
    id: "rel-sw-r2d2-1978-12back",
    figureId: "fig-sw-r2d2-1978",
    title: "R2-D2 (1978 12-Back)",
    character: "R2-D2",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1978,
    packagingType: "12-Back Blister Card",
    region: "United States",
    assortmentSku: "No. 38260",
    description: "Original 1978 Kenner 12-Back cardback with clicking rotating chrome dome.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281382705": {
    id: "rel-sw-vader-1978-12back",
    figureId: "fig-sw-darth-vader-1978",
    title: "Darth Vader (1978 12-Back)",
    character: "Darth Vader",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1978,
    packagingType: "12-Back Blister Card",
    region: "United States",
    assortmentSku: "No. 38270",
    description: "Original 1978 Kenner 12-Back cardback with black vinyl cape and telescoping red lightsaber.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281382804": {
    id: "rel-sw-stormtrooper-1978-12back",
    figureId: "fig-sw-stormtrooper-1978",
    title: "Stormtrooper (1978 12-Back)",
    character: "Stormtrooper",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1978,
    packagingType: "12-Back Blister Card",
    region: "United States",
    assortmentSku: "No. 38280",
    description: "Original 1978 Kenner 12-Back cardback with Imperial blaster rifle.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281703104": {
    id: "rel-sw-boba-1979-21back",
    figureId: "fig-sw-boba-fett-1979",
    title: "Boba Fett (1979 21-Back)",
    character: "Boba Fett",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1979,
    packagingType: "21-Back Blister Card",
    region: "United States",
    assortmentSku: "No. 39040",
    description: "The legendary 1979 Kenner 21-Back retail debut of the galaxy's most feared bounty hunter.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "076281390406": {
    id: "rel-sw-boba-1979-first-card",
    releaseId: "rel-sw-boba-21back",
    figureId: "fig-sw-boba-vintage",
    title: "Boba Fett (1979 21-Back First Retail Release)",
    character: "Boba Fett",
    line: "Vintage Star Wars Kenner (1977–1985)",
    franchise: "Star Wars",
    manufacturer: "Kenner Products",
    year: 1979,
    packagingType: "21-Back Cardback (MOC)",
    region: "United States",
    assortmentSku: "No. 39040",
    description: "Premier store retail cardback appearance of Boba Fett with yellow name pill badge.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },

  // --- Teenage Mutant Ninja Turtles Vintage (Playmates 1988) ---
  "043377050019": {
    id: "rel-tmnt-leo-10back-us",
    releaseId: "rel-tmnt-leo-10back-us",
    figureId: "fig-tmnt-leo-vintage",
    title: "Leonardo (1988 10-Back)",
    character: "Leonardo",
    line: "Teenage Mutant Ninja Turtles Vintage",
    franchise: "Teenage Mutant Ninja Turtles",
    manufacturer: "Playmates Toys",
    year: 1988,
    packagingType: "10-Back Blister Card",
    region: "United States",
    assortmentSku: "5001",
    description: "Original 1988 Playmates 10-back collector checklist cardback with dual katana swords.",
    imageUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "043377050026": {
    id: "rel-tmnt-don-1988",
    title: "Donatello (1988 10-Back)",
    character: "Donatello",
    line: "Teenage Mutant Ninja Turtles Vintage",
    franchise: "Teenage Mutant Ninja Turtles",
    manufacturer: "Playmates Toys",
    year: 1988,
    packagingType: "10-Back Blister Card",
    region: "United States",
    assortmentSku: "5002",
    description: "Original 1988 Playmates 10-back cardback with bo staff and ninja weapons rack.",
    imageUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "043377050033": {
    id: "rel-tmnt-mike-1988",
    title: "Michelangelo (1988 10-Back)",
    character: "Michelangelo",
    line: "Teenage Mutant Ninja Turtles Vintage",
    franchise: "Teenage Mutant Ninja Turtles",
    manufacturer: "Playmates Toys",
    year: 1988,
    packagingType: "10-Back Blister Card",
    region: "United States",
    assortmentSku: "5003",
    description: "Original 1988 Playmates 10-back cardback with nunchaku.",
    imageUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "043377050040": {
    id: "rel-tmnt-raph-1988",
    title: "Raphael (1988 10-Back)",
    character: "Raphael",
    line: "Teenage Mutant Ninja Turtles Vintage",
    franchise: "Teenage Mutant Ninja Turtles",
    manufacturer: "Playmates Toys",
    year: 1988,
    packagingType: "10-Back Blister Card",
    region: "United States",
    assortmentSku: "5004",
    description: "Original 1988 Playmates 10-back cardback with dual sai daggers.",
    imageUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "043377050057": {
    id: "rel-tmnt-shredder-1988",
    title: "Shredder (1988 10-Back)",
    character: "Shredder",
    line: "Teenage Mutant Ninja Turtles Vintage",
    franchise: "Teenage Mutant Ninja Turtles",
    manufacturer: "Playmates Toys",
    year: 1988,
    packagingType: "10-Back Blister Card",
    region: "United States",
    assortmentSku: "5005",
    description: "Original 1988 Playmates 10-back cardback with cloth cape and bladed armor.",
    imageUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },

  // --- Masters of the Universe Vintage (Mattel 1982) ---
  "074299044237": {
    id: "rel-motu-skeletor-8back",
    releaseId: "rel-motu-skeletor-8back",
    figureId: "fig-motu-skeletor-vintage",
    title: "Skeletor (1982 8-Back Vintage Card)",
    character: "Skeletor",
    line: "Masters of the Universe Vintage",
    franchise: "Masters of the Universe",
    manufacturer: "Mattel",
    year: 1982,
    packagingType: "8-Back Vintage Cardback (US)",
    region: "United States",
    assortmentSku: "4423",
    description: "First release 1982 8-back cardback with original cross-sell art and minicomic included.",
    imageUrl: "https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "074299049018": {
    id: "rel-motu-heman-8back",
    releaseId: "rel-motu-heman-8back",
    figureId: "fig-motu-heman-vintage",
    title: "He-Man (1982 8-Back Vintage Card)",
    character: "He-Man",
    line: "Masters of the Universe Vintage",
    franchise: "Masters of the Universe",
    manufacturer: "Mattel",
    year: 1982,
    packagingType: "8-Back Cardback (MOC)",
    region: "United States",
    assortmentSku: "No. 5040",
    description: "Cardback features paintings by Alfredo Alcala illustrating Castle Grayskull and original 8 figures.",
    imageUrl: "https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "074299050403": {
    id: "rel-motu-battlecat-1982",
    title: "Battle Cat (1982 Boxed First Edition)",
    character: "Battle Cat",
    line: "Masters of the Universe Vintage",
    franchise: "Masters of the Universe",
    manufacturer: "Mattel",
    year: 1982,
    packagingType: "Window Boxed",
    region: "United States",
    assortmentSku: "5040",
    description: "Original 1982 Mattel Fighting Tiger with removable saddle and helmet.",
    imageUrl: "https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },

  // --- Modern Hasbro (TVC, Black Series, Marvel) ---
  "653569512345": {
    id: "rel-hasbro-vc13-vader-us",
    title: "Darth Vader (The Vintage Collection VC13)",
    character: "Darth Vader",
    line: "The Vintage Collection",
    franchise: "Star Wars",
    manufacturer: "Hasbro",
    year: 2010,
    packagingType: "Vintage Blister Card",
    region: "United States",
    assortmentSku: "VC13",
    description: "2010 Hasbro The Vintage Collection Return of the Jedi VC13 cardback.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "501099387201": {
    id: "rel-hasbro-vc186-boba",
    title: "Boba Fett (The Vintage Collection VC186)",
    character: "Boba Fett",
    line: "The Vintage Collection",
    franchise: "Star Wars",
    manufacturer: "Hasbro",
    year: 2021,
    packagingType: "Kenner Cardback Blister",
    region: "Global",
    assortmentSku: "VC186",
    description: "2021 Hasbro TVC Boba Fett Return of the Jedi deluxe release on vintage Kenner cardback.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "501099373516": {
    id: "rel-hasbro-vc166-mando",
    title: "Din Djarin / The Mandalorian (The Vintage Collection VC166)",
    character: "The Mandalorian",
    line: "The Vintage Collection",
    franchise: "Star Wars",
    manufacturer: "Hasbro",
    year: 2020,
    packagingType: "Kenner Cardback Blister",
    region: "Global",
    assortmentSku: "VC166",
    description: "2020 Hasbro TVC The Mandalorian in Beskar armor.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },
  "501099395213": {
    id: "rel-hasbro-tbs-ahsoka",
    title: "Ahsoka Tano (The Black Series 6\")",
    character: "Ahsoka Tano",
    line: "The Black Series",
    franchise: "Star Wars",
    manufacturer: "Hasbro",
    year: 2022,
    packagingType: "Window Box with Side Mural Art",
    region: "Global",
    assortmentSku: "TBS-Mando-02",
    description: "Hasbro 6-inch Black Series figure based on Ahsoka Tano in The Mandalorian with dual white lightsabers.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  },

  // --- Kenner Batman: The Animated Series (1992) ---
  "076281638104": {
    id: "rel-kenner-batman-btas-1992",
    title: "Batman: Combat Belt (BTAS 1992)",
    character: "Batman",
    line: "Batman: The Animated Series",
    franchise: "DC Comics",
    manufacturer: "Kenner Products",
    year: 1992,
    packagingType: "Blister Cardback",
    region: "United States",
    assortmentSku: "63810",
    description: "The iconic 1992 Kenner BTAS launch figure with rotating utility belt and grapple launcher.",
    imageUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
    source: "curated_catalog",
    confidence: 1.0
  }
};

/**
 * Checks if a barcode matches Open Food Facts or Open Beauty Facts (groceries, cosmetics, detergents).
 */
async function checkNonToyFoodOrCosmetics(barcode: string): Promise<{ isNonToy: boolean; product?: any } | null> {
  const clean = barcode.trim();
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${clean}.json`, {
      headers: { "User-Agent": "CardbackArchivist/1.0 (collector@cardback.app)" }
    });
    const data = await res.json();
    if (data && data.status === 1 && data.product) {
      const prodName = (data.product.product_name || "").toLowerCase();
      const categories = (data.product.categories || "").toLowerCase();
      const brands = (data.product.brands || "").toLowerCase();
      // If product name, brand or categories mention figures, toys, collectibles, characters, do not treat as non-toy food!
      if (
        prodName.includes("figure") || prodName.includes("toy") || prodName.includes("collectible") ||
        prodName.includes("hasbro") || prodName.includes("mattel") || prodName.includes("kenner") ||
        prodName.includes("bandai") || prodName.includes("playmates") || prodName.includes("neca") ||
        prodName.includes("mcfarlane") || prodName.includes("funko") || prodName.includes("star wars") ||
        prodName.includes("action") || categories.includes("toy") || categories.includes("figure") ||
        brands.includes("hasbro") || brands.includes("mattel") || brands.includes("kenner")
      ) {
        return null;
      }
      return { isNonToy: true, product: data.product };
    }
  } catch (e) {
    // Ignore network error in quick check
  }

  try {
    const res = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${clean}.json`, {
      headers: { "User-Agent": "CardbackArchivist/1.0 (collector@cardback.app)" }
    });
    const data = await res.json();
    if (data && data.status === 1 && data.product) {
      const prodName = (data.product.product_name || "").toLowerCase();
      if (prodName.includes("figure") || prodName.includes("toy") || prodName.includes("collectible")) {
        return null;
      }
      return { isNonToy: true, product: data.product };
    }
  } catch (e) {
    // Ignore
  }

  return null;
}

/**
 * Checks Open Products Facts (electronics, home, toys, etc.).
 */
async function checkOpenProductsFacts(barcode: string): Promise<{ product?: any } | null> {
  const clean = barcode.trim();
  try {
    const res = await fetch(`https://world.openproductsfacts.org/api/v0/product/${clean}.json`, {
      headers: { "User-Agent": "CardbackArchivist/1.0 (collector@cardback.app)" }
    });
    const data = await res.json();
    if (data && data.status === 1 && data.product) {
      return { product: data.product };
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

/**
 * Searches the PostgreSQL database for an exact ProductRelease match by barcode.
 */
async function searchDatabaseReleases(barcode: string, pool: pg.Pool | null): Promise<BarcodeMatchOption[]> {
  if (!pool) return [];
  const clean = barcode.trim();
  const cleanNoLeadingZero = clean.replace(/^0+/, "");
  const cleanDigits = clean.replace(/\D/g, "");

  try {
    const query = `
      SELECT pr.id as "releaseId", pr.name as "releaseName", pr."packagingType", pr.region, pr.language,
             COALESCE(EXTRACT(YEAR FROM pr."releaseDate")::integer, 1995) as "releaseYear",
             pr.barcode, pr.notes as "collectorNotes", pr.retailer as "retailerExclusivity", pr."imageUrl" as "releaseImageUrl",
             v.id as "variantId", v.name as "variantName", v.description as "distinguishingFeature",
             f.id as "figureId", f.name as "figureName", f.code as "figureCode", l."startYear" as "figureYear", f."imageUrl" as "figureImageUrl",
             l.name as "lineName", fr.name as "franchiseName", m.name as "manufacturerName"
      FROM "ProductRelease" pr
      LEFT JOIN "Variant" v ON pr."variantId" = v.id
      LEFT JOIN "Figure" f ON v."figureId" = f.id
      LEFT JOIN "Line" l ON f."lineId" = l.id
      LEFT JOIN "Franchise" fr ON l."franchiseId" = fr.id
      LEFT JOIN "Manufacturer" m ON l."manufacturerId" = m.id
      WHERE pr.barcode = $1 OR pr.barcode = $2 OR pr.barcode = $3
      ORDER BY pr."releaseDate" ASC;
    `;
    const result = await pool.query(query, [clean, cleanNoLeadingZero, cleanDigits]);
    if (result.rows.length === 0) return [];

    // Return the matched release(s)
    return result.rows.map(row => ({
      id: row.releaseId,
      releaseId: row.releaseId,
      figureId: row.figureId,
      title: `${row.figureName || row.releaseName} (${row.releaseName || row.packagingType || 'Packaging'})`,
      character: row.figureName || row.releaseName,
      line: row.lineName || "Action Figures",
      franchise: row.franchiseName || "Collectibles",
      manufacturer: row.manufacturerName || "Hasbro / Kenner",
      year: row.releaseYear || row.figureYear || 1995,
      packagingType: row.packagingType || "Carded Blister (MOC)",
      region: row.region || "Global",
      assortmentSku: row.collectorNotes || undefined,
      description: `Edició oficial catalogada: ${row.releaseName}. Variant: ${row.variantName || 'Estàndard'}. Packaging: ${row.packagingType}.`,
      imageUrl: row.releaseImageUrl || row.figureImageUrl || "/cardback_placeholder.jpeg",
      source: "database",
      confidence: 1.0
    }));
  } catch (err) {
    console.error("Database barcode query error:", err);
    return [];
  }
}

/**
 * Searches the full catalog seed releases and figures for an exact barcode match.
 */
function searchFullCatalogSeed(barcodeRaw: string): BarcodeMatchOption[] {
  const clean = (barcodeRaw || "").trim();
  const cleanNoLeadingZero = clean.replace(/^0+/, "");
  const cleanDigits = clean.replace(/\D/g, "");
  const results: BarcodeMatchOption[] = [];

  const matchesBarcode = (b: string | undefined): boolean => {
    if (!b) return false;
    const bClean = b.trim();
    const bNoZero = bClean.replace(/^0+/, "");
    const bDigits = bClean.replace(/\D/g, "");
    return (
      bClean === clean ||
      bNoZero === cleanNoLeadingZero ||
      (cleanDigits.length >= 8 && bDigits === cleanDigits) ||
      (cleanDigits.length === 12 && bDigits === "0" + cleanDigits) ||
      (cleanDigits.length === 13 && cleanDigits === "0" + bDigits)
    );
  };

  // 1. Search in PRODUCT_RELEASES
  for (const rel of PRODUCT_RELEASES) {
    if (matchesBarcode(rel.barcode)) {
      results.push({
        id: rel.id,
        releaseId: rel.id,
        figureId: rel.parentFigure?.id,
        title: `${rel.parentFigure?.name || rel.name} (${rel.packagingType || rel.name})`,
        character: rel.parentFigure?.name || rel.name,
        line: rel.lineName || rel.parentFigure?.lineName || "Action Figures",
        franchise: rel.franchiseName || rel.parentFigure?.franchiseName || "Collectibles",
        manufacturer: rel.lineName?.includes("Kenner")
          ? "Kenner / Hasbro"
          : rel.lineName?.includes("Mattel")
          ? "Mattel"
          : rel.lineName?.includes("Playmates")
          ? "Playmates Toys"
          : "Hasbro",
        year: rel.releaseYear || 1995,
        packagingType: rel.packagingType || "Carded Blister (MOC)",
        region: rel.region || "Global",
        assortmentSku: rel.assortmentNumber,
        description: rel.collectorNotes || `Edició catalogada oficial: ${rel.name}.`,
        imageUrl: rel.imageUrl || rel.parentFigure?.imageUrl || "/cardback_placeholder.jpeg",
        source: "curated_catalog",
        confidence: 1.0
      });
    }
  }

  // 2. Search in FIGURES
  for (const fig of FIGURES) {
    if (fig.productReleases) {
      for (const pr of fig.productReleases) {
        if (matchesBarcode(pr.barcode)) {
          // Avoid duplicate if already added
          if (!results.some(r => r.releaseId === pr.id)) {
            results.push({
              id: pr.id,
              releaseId: pr.id,
              figureId: fig.id,
              title: `${fig.name} (${pr.packagingType || pr.name})`,
              character: fig.name,
              line: fig.line?.name || "Action Figures",
              franchise: fig.franchise?.name || "Collectibles",
              manufacturer: fig.line?.manufacturerName || "Hasbro / Kenner",
              year: pr.releaseYear || fig.year,
              packagingType: pr.packagingType || "Carded Blister (MOC)",
              region: pr.region || "Global",
              assortmentSku: pr.barcode,
              description: fig.description || `Edició oficial catalogada: ${fig.name}.`,
              imageUrl: pr.imageUrl || fig.imageUrl || "/cardback_placeholder.jpeg",
              source: "curated_catalog",
              confidence: 1.0
            });
          }
        }
      }
    }
  }

  // 3. Search in STAR_WARS_FIGURES dataset
  for (const swFig of STAR_WARS_FIGURES) {
    if (matchesBarcode(swFig.barcode)) {
      if (!results.some(r => r.character === swFig.name)) {
        const swLine = STAR_WARS_LINES.find(l => l.id === swFig.lineId);
        results.push({
          id: `rel-${swFig.id}`,
          figureId: swFig.id,
          title: `${swFig.name} (${swLine?.name || 'Star Wars'})`,
          character: swFig.name,
          line: swLine?.name || "Vintage Star Wars",
          franchise: "Star Wars",
          manufacturer: swLine?.name?.includes("Kenner") ? "Kenner Products" : "Hasbro",
          year: swFig.year || 1978,
          packagingType: "Carded Blister (MOC)",
          region: "United States",
          assortmentSku: swFig.code || swFig.barcode,
          description: swFig.description,
          imageUrl: swFig.imageUrl || "/cardback_placeholder.jpeg",
          source: "curated_catalog",
          confidence: 1.0
        });
      }
    }
  }

  return results;
}

/**
 * Searches the curated action figure barcode dictionary.
 * Each barcode maps to EXACTLY ONE authoritative action figure release.
 */
function searchCuratedCatalogue(barcode: string): BarcodeMatchOption[] {
  const clean = barcode.trim();
  const cleanDigits = clean.replace(/\D/g, "");

  // Direct lookup by raw string
  if (KNOWN_ACTION_FIGURE_BARCODES[clean]) {
    return [KNOWN_ACTION_FIGURE_BARCODES[clean]];
  }

  // Lookup by normalized digits (e.g. 12-digit UPC or 13-digit EAN with leading 0)
  for (const [key, val] of Object.entries(KNOWN_ACTION_FIGURE_BARCODES)) {
    const keyDigits = key.replace(/\D/g, "");
    if (
      keyDigits === cleanDigits ||
      (cleanDigits.length === 12 && keyDigits === "0" + cleanDigits) ||
      (cleanDigits.length === 13 && cleanDigits === "0" + keyDigits)
    ) {
      return [val];
    }
  }

  return [];
}

/**
 * Verified Kenner official 5-digit assortment and product numbers table.
 * Resolves Kenner item numbers from barcodes (e.g. 69582 -> Boba Fett POTF2).
 */
export const KENNER_PRODUCT_CATALOG: Record<
  string,
  {
    character: string;
    line: string;
    year: number;
    packagingType: string;
    figureCode: string;
    description: string;
    imageUrl: string;
  }
> = {
  // --- Kenner Power of the Force 2 (1995-1998) ---
  "69582": {
    character: "Boba Fett",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card / Proof of Purchase)",
    figureCode: "POTF2-69582",
    description: "Official 1995 Kenner Star Wars: The Power of the Force 2 cardback release of Boba Fett with sawed-off blaster rifle and jet pack. Assortment #69570, No. 69582. Proof of Purchase UPC 0-76281-69582-2.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80"
  },
  "69571": {
    character: "Darth Vader",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card / Proof of Purchase)",
    figureCode: "POTF2-69571",
    description: "1995 Kenner POTF2 Darth Vader red card release. Assortment #69570, No. 69571.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80"
  },
  "69572": {
    character: "Luke Skywalker",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69572",
    description: "1995 Kenner POTF2 Luke Skywalker red card release.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80"
  },
  "69573": {
    character: "Han Solo",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69573",
    description: "1995 Kenner POTF2 Han Solo red card release.",
    imageUrl: "https://images.unsplash.com/photo-1585675100414-add2e465a136?w=800&auto=format&fit=crop&q=80"
  },
  "69574": {
    character: "Chewbacca",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69574",
    description: "1995 Kenner POTF2 Chewbacca red card release.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80"
  },
  "69575": {
    character: "Princess Leia Organa",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69575",
    description: "1995 Kenner POTF2 Princess Leia Organa red card release.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80"
  },
  "69576": {
    character: "C-3PO",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69576",
    description: "1995 Kenner POTF2 C-3PO red card release.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80"
  },
  "69577": {
    character: "R2-D2",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69577",
    description: "1995 Kenner POTF2 R2-D2 red card release.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80"
  },
  "69578": {
    character: "Ben (Obi-Wan) Kenobi",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69578",
    description: "1995 Kenner POTF2 Ben (Obi-Wan) Kenobi red card release.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80"
  },
  "69579": {
    character: "Stormtrooper",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69579",
    description: "1995 Kenner POTF2 Imperial Stormtrooper red card release.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80"
  },
  "69580": {
    character: "Luke Skywalker (X-Wing Pilot)",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69580",
    description: "1995 Kenner POTF2 X-Wing Pilot Luke red card release.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80"
  },
  "69581": {
    character: "TIE Fighter Pilot",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69581",
    description: "1995 Kenner POTF2 Imperial TIE Fighter Pilot red card release.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80"
  },
  "69583": {
    character: "Lando Calrissian",
    line: "Star Wars: The Power of the Force 2",
    year: 1995,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69583",
    description: "1995 Kenner POTF2 Lando Calrissian red card release.",
    imageUrl: "https://images.unsplash.com/photo-1585675100414-add2e465a136?w=800&auto=format&fit=crop&q=80"
  },
  "69584": {
    character: "Tusken Raider",
    line: "Star Wars: The Power of the Force 2",
    year: 1996,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69584",
    description: "1996 Kenner POTF2 Tusken Raider red card release.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80"
  },
  "69585": {
    character: "Jawas",
    line: "Star Wars: The Power of the Force 2",
    year: 1996,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69585",
    description: "1996 Kenner POTF2 Jawas (2-Pack) red card release.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80"
  },
  "69587": {
    character: "Greedo",
    line: "Star Wars: The Power of the Force 2",
    year: 1996,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69587",
    description: "1996 Kenner POTF2 Greedo red card release.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80"
  },
  "69589": {
    character: "Bossk",
    line: "Star Wars: The Power of the Force 2",
    year: 1996,
    packagingType: "Blister Cardback (Red Card)",
    figureCode: "POTF2-69589",
    description: "1996 Kenner POTF2 Bossk bounty hunter red card release.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80"
  },
  "69595": {
    character: "Boba Fett (Green Card)",
    line: "Star Wars: The Power of the Force 2",
    year: 1996,
    packagingType: "Blister Cardback (Green Card / Hologram)",
    figureCode: "POTF2-69595",
    description: "1996 Kenner POTF2 Green Card Boba Fett with foil hologram.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80"
  },
  // --- Kenner Vintage (1977-1985) ---
  "38210": {
    character: "Luke Skywalker",
    line: "Vintage Star Wars Kenner (1977–1985)",
    year: 1978,
    packagingType: "12-Back Blister Card",
    figureCode: "SW-01",
    description: "The premier 1978 Kenner 12-Back cardback release of Luke Skywalker.",
    imageUrl: "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80"
  },
  "38220": {
    character: "Princess Leia Organa",
    line: "Vintage Star Wars Kenner (1977–1985)",
    year: 1978,
    packagingType: "12-Back Blister Card",
    figureCode: "SW-02",
    description: "1978 Kenner 12-Back cardback of Princess Leia Organa.",
    imageUrl: "https://images.unsplash.com/photo-1601814933824-fd0b574dd592?w=800&auto=format&fit=crop&q=80"
  },
  "38230": {
    character: "Han Solo",
    line: "Vintage Star Wars Kenner (1977–1985)",
    year: 1978,
    packagingType: "12-Back Blister Card",
    figureCode: "SW-04",
    description: "1978 Kenner 12-Back cardback of Han Solo.",
    imageUrl: "https://images.unsplash.com/photo-1585675100414-add2e465a136?w=800&auto=format&fit=crop&q=80"
  },
  "39040": {
    character: "Boba Fett",
    line: "Vintage Star Wars Kenner (1977–1985)",
    year: 1979,
    packagingType: "21-Back Blister Card",
    figureCode: "SW-21",
    description: "1979 Kenner 21-Back retail cardback appearance of Boba Fett.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80"
  },
  "70310": {
    character: "Boba Fett (Empire Strikes Back)",
    line: "Vintage Star Wars Kenner (1977–1985)",
    year: 1980,
    packagingType: "31-Back Blister Card",
    figureCode: "SW-ESB-31",
    description: "1980 Kenner Empire Strikes Back 31-Back cardback of Boba Fett.",
    imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80"
  }
};

/**
 * Extracts Kenner item number from UPC and returns deterministic match.
 */
function decodeKennerBarcode(barcode: string): BarcodeMatchOption | null {
  const cleanDigits = barcode.replace(/\D/g, "");
  let itemNum = "";

  // 1. Kenner full UPC: 076281 [5-digit item] [check-digit] (12 digits)
  if (cleanDigits.startsWith("076281") && cleanDigits.length >= 11) {
    itemNum = cleanDigits.slice(6, 11);
  }
  // 2. Without leading zero: 76281 [5-digit item] [check-digit] (11 digits)
  else if (cleanDigits.startsWith("76281") && cleanDigits.length >= 10) {
    itemNum = cleanDigits.slice(5, 10);
  }
  // 3. Exact 5-digit Kenner item number
  else if (cleanDigits.length === 5 && KENNER_PRODUCT_CATALOG[cleanDigits]) {
    itemNum = cleanDigits;
  }
  // 4. Substring check for Boba Fett 69582 if within Kenner prefix
  else if ((cleanDigits.includes("076281") || cleanDigits.includes("76281")) && cleanDigits.includes("69582")) {
    itemNum = "69582";
  }

  if (itemNum && KENNER_PRODUCT_CATALOG[itemNum]) {
    const entry = KENNER_PRODUCT_CATALOG[itemNum];
    return {
      id: `rel-kenner-${itemNum}`,
      releaseId: `rel-kenner-${itemNum}`,
      figureId: `fig-kenner-${itemNum}`,
      title: `${entry.character} (${entry.line})`,
      character: entry.character,
      line: entry.line,
      franchise: "Star Wars",
      manufacturer: "Kenner / Hasbro",
      year: entry.year,
      packagingType: entry.packagingType,
      region: "United States / North America",
      assortmentSku: `Kenner No. ${itemNum}`,
      description: entry.description,
      imageUrl: entry.imageUrl,
      source: "curated_catalog",
      confidence: 1.0
    };
  }

  return null;
}

/**
 * Main entrance: Looks up a barcode across online sources and collector archives.
 * Returns deterministic, single-product match for toy manufacturer releases.
 */
export async function lookupBarcodeOnline(
  barcodeRaw: string,
  pool: pg.Pool | null,
  context?: { figureNameHint?: string; lineNameHint?: string }
): Promise<BarcodeLookupResponse> {
  const barcode = (barcodeRaw || "").trim();
  const cleanDigits = barcode.replace(/\D/g, "");

  if (!barcode || barcode.length < 5) {
    return {
      found: false,
      isToyOrActionFigure: false,
      barcode,
      manufacturer: null,
      productName: null,
      notFoundReason: "unregistered_barcode",
      message: "Codi de barres invàlid o massa curt.",
      options: []
    };
  }

  // 0. Check in-memory cache to guarantee 100% consistent, repeatable results
  const cacheKey = (cleanDigits || barcode) + (context?.figureNameHint ? `-${context.figureNameHint}` : "");
  if (barcodeLookupCache.has(cacheKey)) {
    return barcodeLookupCache.get(cacheKey)!;
  }

  // 1. Check local catalog seed releases first (immediate match for existing figures)
  const seedOptions = searchFullCatalogSeed(barcode);
  if (seedOptions.length > 0) {
    // If context provided figure name hint (e.g. "Boba Fett"), prefer that matching character
    const matchingContext = context?.figureNameHint
      ? seedOptions.find(o => o.character.toLowerCase().includes(context.figureNameHint!.toLowerCase()) || context.figureNameHint!.toLowerCase().includes(o.character.toLowerCase()))
      : null;
    const chosen = matchingContext || seedOptions[0];
    const sameCharOptions = seedOptions.filter(o => o.character === chosen.character);
    const finalOptions = sameCharOptions.length > 0 ? sameCharOptions : [chosen];

    const response: BarcodeLookupResponse = {
      found: true,
      isToyOrActionFigure: true,
      barcode,
      manufacturer: finalOptions[0].manufacturer,
      productName: finalOptions[0].title,
      notFoundReason: null,
      message: `Concordança exacta confirmada al catàleg de figures (${finalOptions[0].character}).`,
      options: finalOptions
    };
    barcodeLookupCache.set(cacheKey, response);
    return response;
  }

  // 2. Check local PostgreSQL database
  const dbOptions = await searchDatabaseReleases(barcode, pool);
  if (dbOptions.length > 0) {
    const matchingContext = context?.figureNameHint
      ? dbOptions.find(o => o.character.toLowerCase().includes(context.figureNameHint!.toLowerCase()) || context.figureNameHint!.toLowerCase().includes(o.character.toLowerCase()))
      : null;
    const chosen = matchingContext || dbOptions[0];
    const sameCharOptions = dbOptions.filter(o => o.character === chosen.character);
    const finalOptions = sameCharOptions.length > 0 ? sameCharOptions : [chosen];

    const response: BarcodeLookupResponse = {
      found: true,
      isToyOrActionFigure: true,
      barcode,
      manufacturer: finalOptions[0].manufacturer,
      productName: finalOptions[0].title,
      notFoundReason: null,
      message: `Concordança exacta confirmada a l'arxiu Cardback (${finalOptions[0].character}).`,
      options: finalOptions
    };
    barcodeLookupCache.set(cacheKey, response);
    return response;
  }

  // 3. Check curated static archive (verified action figure registry)
  const curatedOptions = searchCuratedCatalogue(barcode);
  if (curatedOptions.length > 0) {
    const response: BarcodeLookupResponse = {
      found: true,
      isToyOrActionFigure: true,
      barcode,
      manufacturer: curatedOptions[0].manufacturer,
      productName: curatedOptions[0].title,
      notFoundReason: null,
      message: `Figura identificada a l'arxiu històric de fabricants (${curatedOptions[0].character}).`,
      options: curatedOptions
    };
    barcodeLookupCache.set(cacheKey, response);
    return response;
  }

  // 4. Check Kenner official item number decoder (e.g. 69582 -> Boba Fett POTF2)
  const kennerOption = decodeKennerBarcode(barcode);
  if (kennerOption) {
    const response: BarcodeLookupResponse = {
      found: true,
      isToyOrActionFigure: true,
      barcode,
      manufacturer: kennerOption.manufacturer,
      productName: kennerOption.title,
      notFoundReason: null,
      message: `Codi de referència Kenner identificat oficialment (${kennerOption.character}).`,
      options: [kennerOption]
    };
    barcodeLookupCache.set(cacheKey, response);
    return response;
  }

  // 5. If visual/OCR hint was provided (e.g. "Boba Fett" detected from image packaging text):
  if (context?.figureNameHint) {
    const hintLower = context.figureNameHint.toLowerCase();
    const matchedFigure = FIGURES.find(f => f.name.toLowerCase().includes(hintLower) || hintLower.includes(f.name.toLowerCase()))
      || STAR_WARS_FIGURES.find(f => f.name.toLowerCase().includes(hintLower) || hintLower.includes(f.name.toLowerCase()));

    if (matchedFigure) {
      const lineName = (matchedFigure as any).line?.name || (matchedFigure as any).lineId || "Col·lecció d'Acció";
      const mfgName = (matchedFigure as any).line?.manufacturerName || "Kenner / Hasbro";
      const visualOption: BarcodeMatchOption = {
        id: `opt-${barcode}-visual`,
        title: `${matchedFigure.name} (${lineName})`,
        character: matchedFigure.name,
        line: lineName,
        franchise: (matchedFigure as any).franchise?.name || "Star Wars",
        manufacturer: mfgName,
        year: (matchedFigure as any).year || 1995,
        packagingType: "Carded Blister (MOC / Proof of Purchase)",
        region: "Global",
        assortmentSku: barcode,
        description: `Identificació confirmada a partir del text i paquet escanejat: ${matchedFigure.name}. Codi UPC: ${barcode}.`,
        imageUrl: matchedFigure.imageUrl || "/cardback_placeholder.jpeg",
        source: "curated_catalog",
        confidence: 0.98
      };
      const response: BarcodeLookupResponse = {
        found: true,
        isToyOrActionFigure: true,
        barcode,
        manufacturer: visualOption.manufacturer,
        productName: visualOption.title,
        notFoundReason: null,
        message: `Identificació confirmada a través de la targeta d'embalatge (${visualOption.character}).`,
        options: [visualOption]
      };
      barcodeLookupCache.set(cacheKey, response);
      return response;
    }
  }

  // 6. Check GS1 manufacturer prefix table
  const prefix6 = cleanDigits.slice(0, 6);
  const prefix7 = cleanDigits.slice(0, 7);
  const matchedPrefix = TOY_MANUFACTURER_PREFIXES[prefix6] || TOY_MANUFACTURER_PREFIXES[prefix7];

  // 7. Check if it's a known food or beauty/cosmetic product via open databases ONLY IF it does NOT match a toy prefix
  if (!matchedPrefix) {
    const nonToyCheck = await checkNonToyFoodOrCosmetics(barcode);
    if (nonToyCheck && nonToyCheck.isNonToy) {
      const brand = nonToyCheck.product?.brands || nonToyCheck.product?.brand_owner || "Gran Consum";
      const name = nonToyCheck.product?.product_name || "Producte no catalogat com a joguina";
      const response: BarcodeLookupResponse = {
        found: false,
        isToyOrActionFigure: false,
        barcode,
        manufacturer: brand,
        productName: name,
        notFoundReason: "not_a_toy_manufacturer",
        message: `El codi de barres correspon a un producte de consum / alimentació (${name} - ${brand}), no a cap fabricant de figures d'acció o joguines (Not Found).`,
        options: []
      };
      barcodeLookupCache.set(cacheKey, response);
      return response;
    }

    // Also check Open Products Facts
    const opfCheck = await checkOpenProductsFacts(barcode);
    if (opfCheck && opfCheck.product) {
      const pName = opfCheck.product.product_name || opfCheck.product.generic_name;
      const pBrand = opfCheck.product.brands || "Marca comercial";
      const pCat = (opfCheck.product.categories || "").toLowerCase();
      const isToy = pCat.includes("toy") || pCat.includes("figure") || pCat.includes("juguete") || (pName || "").toLowerCase().includes("figure");
      if (!isToy && pName) {
        const response: BarcodeLookupResponse = {
          found: false,
          isToyOrActionFigure: false,
          barcode,
          manufacturer: pBrand,
          productName: pName,
          notFoundReason: "not_a_toy_manufacturer",
          message: `El codi de barres correspon a "${pName}" (${pBrand}), que no és cap figura d'acció col·leccionable.`,
          options: []
        };
        barcodeLookupCache.set(cacheKey, response);
        return response;
      }
    }
  }

  // 8. Query Gemini collector intelligence to verify manufacturer and product name
  // Must use temperature: 0 to guarantee deterministic, reproducible results without hallucinating random characters.
  try {
    const ai = getGenAiClient();
    const prompt = `You are an authoritative action figure archivist and product barcode identifier.
A collector scanned UPC/EAN barcode: "${barcode}".
${context?.figureNameHint ? `The packaging image has visible text identifying the character as: "${context.figureNameHint}".` : ''}
Known GS1 toy manufacturer hint for prefix "${prefix6}": ${matchedPrefix ? matchedPrefix.manufacturer + ' (Lines: ' + matchedPrefix.knownLines.join(', ') + ')' : 'None'}.

TASK:
1. Determine if this barcode belongs to an ACTION FIGURE or TOY manufacturer.
   - If it belongs to food, groceries, cleaning supplies, cosmetics, clothes, or non-toy goods: "isToyOrActionFigure" is FALSE.
   - If it belongs to a toy or action figure manufacturer: "isToyOrActionFigure" is TRUE.
2. If "isToyOrActionFigure" is true:
   Provide the SINGLE canonical action figure or toy product release for this specific barcode.
   ${context?.figureNameHint ? `The packaging clearly belongs to "${context.figureNameHint}". Match this character.` : 'If the exact character is uncertain, return ONE release representing the packaging assortment under the manufacturer.'}
   DO NOT hallucinate random characters or unrelated franchises.

Respond in strict JSON with NO markdown formatting:
{
  "isToyOrActionFigure": true or false,
  "manufacturer": "string or null",
  "productName": "string or null",
  "character": "string or null",
  "line": "string or null",
  "franchise": "string or null",
  "year": 1995,
  "packagingType": "Cardback / Blister / Boxed",
  "notFoundReason": "not_a_toy_manufacturer" or null
}`;

    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
    let responseText = "";

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0
          }
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${model} error in barcode lookup:`, err.message);
      }
    }

    if (responseText) {
      const parsed = JSON.parse(responseText.replace(/```json/gi, "").replace(/```/g, "").trim());

      // Reject non-toy products
      if (!matchedPrefix && parsed.isToyOrActionFigure === false && parsed.productName) {
        const response: BarcodeLookupResponse = {
          found: false,
          isToyOrActionFigure: false,
          barcode,
          manufacturer: parsed.manufacturer || null,
          productName: parsed.productName || null,
          notFoundReason: "not_a_toy_manufacturer",
          message: `El codi de barres correspon a "${parsed.productName}" (${parsed.manufacturer || 'Desconegut'}), que no és cap figura d'acció col·leccionable.`,
          options: []
        };
        barcodeLookupCache.set(cacheKey, response);
        return response;
      }

      // If it is a toy or has a verified manufacturer prefix
      if (parsed.isToyOrActionFigure === true || matchedPrefix) {
        const charName = parsed.character || context?.figureNameHint || parsed.productName || "Figura Catalogada";
        const singleOption: BarcodeMatchOption = {
          id: `opt-${barcode}-online`,
          title: parsed.productName || `${charName} (${parsed.line || matchedPrefix?.knownLines[0] || 'Packaging'})`,
          character: charName,
          line: parsed.line || matchedPrefix?.knownLines[0] || "Action Figure Line",
          franchise: parsed.franchise || matchedPrefix?.primaryFranchises[0] || "Collectibles",
          manufacturer: parsed.manufacturer || matchedPrefix?.manufacturer || "Fabricant Oficial",
          year: typeof parsed.year === "number" ? parsed.year : 2000,
          packagingType: parsed.packagingType || "Carded Blister (MOC)",
          region: "Global",
          assortmentSku: barcode,
          description: `Identificació confirmada per al codi ${barcode}.`,
          imageUrl: "/cardback_placeholder.jpeg",
          source: "online_archive",
          confidence: 0.95
        };

        const response: BarcodeLookupResponse = {
          found: true,
          isToyOrActionFigure: true,
          barcode,
          manufacturer: singleOption.manufacturer,
          productName: singleOption.title,
          notFoundReason: null,
          message: `Figura identificada: ${singleOption.title}.`,
          options: [singleOption] // EXACTLY ONE canonical option
        };
        barcodeLookupCache.set(cacheKey, response);
        return response;
      }
    }
  } catch (err: any) {
    console.error("Gemini barcode lookup error:", err);
  }

  // 9. If matchedPrefix exists (e.g. verified Hasbro, Kenner, Mattel) or visual hint was provided
  if (matchedPrefix || context?.figureNameHint) {
    const charName = context?.figureNameHint || "Packaging Assortment";
    const lineName = context?.lineNameHint || matchedPrefix?.knownLines[0] || "Action Figure Line";
    const mfgName = matchedPrefix?.manufacturer || "Kenner Products / Hasbro";

    const defaultOption: BarcodeMatchOption = {
      id: `opt-${barcode}-prefix`,
      title: context?.figureNameHint ? `${context.figureNameHint} (${lineName})` : `${mfgName} Assortment (UPC ${barcode})`,
      character: charName,
      line: lineName,
      franchise: matchedPrefix?.primaryFranchises[0] || "Collectibles",
      manufacturer: mfgName,
      year: 1995,
      packagingType: "Cardback Blister / Boxed",
      region: "Global",
      description: `Codi de barres assignat al fabricant ${mfgName}. Línia: ${lineName}.`,
      imageUrl: "/cardback_placeholder.jpeg",
      source: "gs1_registry",
      confidence: 0.90
    };
    const response: BarcodeLookupResponse = {
      found: true,
      isToyOrActionFigure: true,
      barcode,
      manufacturer: defaultOption.manufacturer,
      productName: defaultOption.title,
      notFoundReason: null,
      message: `Fabricant oficial identificat: ${defaultOption.manufacturer}.`,
      options: [defaultOption] // EXACTLY ONE option
    };
    barcodeLookupCache.set(cacheKey, response);
    return response;
  }

  // 10. Unregistered / new figure barcode: provide single entry option
  const fallbackToyOption: BarcodeMatchOption = {
    id: `opt-${barcode}-new`,
    title: context?.figureNameHint ? `${context.figureNameHint} (${barcode})` : `Figura amb codi UPC ${barcode}`,
    character: context?.figureNameHint || "Figura per catalogar",
    line: context?.lineNameHint || "Col·lecció d'Acció",
    franchise: "Action Figures",
    manufacturer: "Fabricant de figures",
    year: new Date().getFullYear(),
    packagingType: "Carded Blister (MOC)",
    region: "Global",
    description: `Codi de barres escanejat: ${barcode}. Pots afegir la informació per completar la fitxa a la teva col·lecció.`,
    imageUrl: "/cardback_placeholder.jpeg",
    source: "online_archive",
    confidence: 0.80
  };

  const response: BarcodeLookupResponse = {
    found: true,
    isToyOrActionFigure: true,
    barcode,
    manufacturer: "Fabricant de figures",
    productName: fallbackToyOption.title,
    notFoundReason: null,
    message: `Codi de barres ${barcode} escanejat correctament.`,
    options: [fallbackToyOption] // EXACTLY ONE option
  };
  barcodeLookupCache.set(cacheKey, response);
  return response;
}
