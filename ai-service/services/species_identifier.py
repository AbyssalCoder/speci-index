"""
Species Identifier using BioCLIP + fallback classification.
Uses open_clip for zero-shot biological classification.
"""

import io
import logging
from typing import Optional

import torch
import open_clip
from PIL import Image

logger = logging.getLogger(__name__)

# Comprehensive species categories for classification
SPECIES_CATEGORIES = {
    "MAMMAL": [
        "mammal", "dog", "cat", "lion", "tiger", "elephant", "deer", "bear",
        "wolf", "fox", "rabbit", "monkey", "ape", "whale", "dolphin",
        "bat", "horse", "cow", "pig", "sheep", "goat", "leopard",
        "cheetah", "rhino", "hippo", "giraffe", "zebra", "panda",
    ],
    "BIRD": [
        "bird", "eagle", "hawk", "owl", "parrot", "penguin", "flamingo",
        "sparrow", "pigeon", "crow", "robin", "hummingbird", "peacock",
        "swan", "duck", "goose", "pelican", "toucan", "woodpecker",
    ],
    "REPTILE": [
        "reptile", "snake", "lizard", "crocodile", "alligator", "turtle",
        "tortoise", "gecko", "chameleon", "iguana", "cobra", "python",
        "monitor lizard", "komodo dragon",
    ],
    "AMPHIBIAN": [
        "amphibian", "frog", "toad", "salamander", "newt", "axolotl",
        "tree frog", "poison dart frog",
    ],
    "FISH": [
        "fish", "salmon", "trout", "tuna", "shark", "ray", "seahorse",
        "clownfish", "angelfish", "catfish", "bass", "cod", "swordfish",
    ],
    "INSECT": [
        "insect", "butterfly", "moth", "beetle", "ant", "bee", "wasp",
        "dragonfly", "grasshopper", "cricket", "ladybug", "firefly",
        "mantis", "cicada", "cockroach",
    ],
    "ARACHNID": [
        "spider", "scorpion", "tarantula", "tick", "mite",
    ],
    "CRUSTACEAN": [
        "crab", "lobster", "shrimp", "crayfish", "barnacle",
    ],
    "MOLLUSK": [
        "snail", "slug", "octopus", "squid", "clam", "oyster", "mussel",
    ],
    "MARINE": [
        "jellyfish", "sea urchin", "starfish", "coral", "sea anemone",
        "sea cucumber", "nautilus",
    ],
    "FLOWER": [
        "flower", "rose", "sunflower", "lily", "orchid", "tulip",
        "daisy", "lotus", "hibiscus", "lavender", "magnolia",
        "cherry blossom", "marigold", "jasmine", "wildflower",
    ],
    "FUNGI": [
        "mushroom", "fungus", "toadstool", "truffle", "mold",
        "lichen", "bracket fungus", "puffball",
    ],
}

HUMAN_LABELS = [
    "person", "human", "man", "woman", "child", "face", "portrait",
    "selfie", "people", "crowd", "baby",
]

TREE_LABELS = [
    "tree", "oak tree", "pine tree", "palm tree", "maple tree",
    "willow tree", "birch tree", "forest", "woods", "trunk",
    "tree bark", "canopy", "timber",
]

# Build flat label list for zero-shot classification
ALL_LABELS = []
LABEL_TO_CATEGORY = {}

for category, labels in SPECIES_CATEGORIES.items():
    for label in labels:
        ALL_LABELS.append(label)
        LABEL_TO_CATEGORY[label] = category

ALL_LABELS.extend(HUMAN_LABELS)
ALL_LABELS.extend(TREE_LABELS)


class SpeciesIdentifier:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Loading BioCLIP model on {self.device}...")

        # Use BioCLIP for biological species classification
        # Falls back to standard CLIP if BioCLIP is unavailable
        try:
            self.model, _, self.preprocess = open_clip.create_model_and_transforms(
                "hf-hub:imageomics/bioclip"
            )
            self.tokenizer = open_clip.get_tokenizer("hf-hub:imageomics/bioclip")
            logger.info("BioCLIP model loaded")
        except Exception:
            logger.warning("BioCLIP unavailable, falling back to ViT-B-32")
            self.model, _, self.preprocess = open_clip.create_model_and_transforms(
                "ViT-B-32", pretrained="openai"
            )
            self.tokenizer = open_clip.get_tokenizer("ViT-B-32")

        self.model = self.model.to(self.device)
        self.model.eval()

        # Pre-encode text labels
        text_inputs = self.tokenizer(
            [f"a photo of a {label}" for label in ALL_LABELS]
        )
        with torch.no_grad():
            self.text_features = self.model.encode_text(text_inputs.to(self.device))
            self.text_features /= self.text_features.norm(dim=-1, keepdim=True)

        logger.info(f"Encoded {len(ALL_LABELS)} classification labels")

    def identify(self, image_bytes: bytes) -> dict:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_input = self.preprocess(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            image_features = self.model.encode_image(image_input)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            similarity = (image_features @ self.text_features.T).squeeze(0)
            probs = similarity.softmax(dim=0).cpu().numpy()

        # Get top predictions
        top_indices = probs.argsort()[::-1][:10]
        top_label = ALL_LABELS[top_indices[0]]
        top_confidence = float(probs[top_indices[0]])

        # Check if human
        is_human = top_label in HUMAN_LABELS
        human_score = sum(float(probs[ALL_LABELS.index(h)]) for h in HUMAN_LABELS if h in ALL_LABELS)

        # Check if tree
        is_tree = top_label in TREE_LABELS
        tree_score = sum(float(probs[ALL_LABELS.index(t)]) for t in TREE_LABELS if t in ALL_LABELS)

        if is_human or human_score > 0.3:
            return {
                "species": None,
                "confidence": human_score,
                "is_human": True,
                "is_tree": False,
            }

        if is_tree or tree_score > 0.4:
            return {
                "species": None,
                "confidence": tree_score,
                "is_human": False,
                "is_tree": True,
            }

        # Get category
        category = LABEL_TO_CATEGORY.get(top_label, "OTHER")

        # Build species result
        species = {
            "scientificName": self._get_scientific_name(top_label),
            "commonName": top_label.title(),
            "confidence": top_confidence,
            "category": category,
            "conservationStatus": "LC",
            "habitat": None,
            "regions": [],
            "description": None,
            "observationCount": None,
        }

        return {
            "species": species,
            "confidence": top_confidence,
            "is_human": False,
            "is_tree": False,
        }

    def _get_scientific_name(self, common_name: str) -> str:
        """Map common names to scientific names. In production, this would
        query GBIF/Catalogue of Life APIs."""
        # Common mappings for demonstration
        KNOWN_NAMES = {
            "lion": "Panthera leo",
            "tiger": "Panthera tigris",
            "elephant": "Loxodonta africana",
            "eagle": "Aquila chrysaetos",
            "cobra": "Naja naja",
            "sparrow": "Passer domesticus",
            "butterfly": "Lepidoptera sp.",
            "rose": "Rosa sp.",
            "mushroom": "Agaricus sp.",
            "frog": "Anura sp.",
            "shark": "Selachimorpha sp.",
            "octopus": "Octopus vulgaris",
            "peacock": "Pavo cristatus",
            "panda": "Ailuropoda melanoleuca",
            "penguin": "Spheniscidae sp.",
            "owl": "Strigiformes sp.",
            "dolphin": "Delphinidae sp.",
            "turtle": "Testudines sp.",
            "crocodile": "Crocodylidae sp.",
            "bee": "Apis mellifera",
            "ant": "Formicidae sp.",
            "snail": "Gastropoda sp.",
            "crab": "Brachyura sp.",
            "jellyfish": "Cnidaria sp.",
            "orchid": "Orchidaceae sp.",
            "sunflower": "Helianthus annuus",
            "ladybug": "Coccinellidae sp.",
        }
        return KNOWN_NAMES.get(common_name.lower(), f"{common_name.title()} sp.")
