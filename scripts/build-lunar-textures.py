"""Convert NASA SVS CGI Moon Kit imagery into web-ready LunaNav textures.

Downloads lroc_color_poles_8k.tif and ldem_16.tif from NASA SVS item 4720,
then converts them into web-ready assets. No synthetic surface texture is used.
"""

from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlretrieve

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter


ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / "public" / "textures"
NASA_SVS_ROOT = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/"


def main() -> None:
    TEXTURES.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix="lunanav-lro-") as temporary:
        albedo_source = Path(temporary) / "lroc_color_poles_8k.tif"
        elevation_source = Path(temporary) / "ldem_16.tif"
        urlretrieve(NASA_SVS_ROOT + albedo_source.name, albedo_source)
        urlretrieve(NASA_SVS_ROOT + elevation_source.name, elevation_source)

        with Image.open(albedo_source) as source:
            source.convert("RGB").save(
                TEXTURES / "lunar-albedo-8k.jpg",
                quality=96,
                subsampling=0,
                optimize=True,
                progressive=True,
            )

        with Image.open(elevation_source) as source:
            elevation_km = np.asarray(source, dtype=np.float32)

    height, width = elevation_km.shape
    min_km = float(elevation_km.min())
    max_km = float(elevation_km.max())
    normalized = np.clip((elevation_km - min_km) / (max_km - min_km), 0, 1)
    height_16 = np.round(normalized * 65535).astype(np.uint16)
    Image.fromarray(height_16).save(
        TEXTURES / "lunar-elevation-16ppd.png", optimize=True
    )

    # Low-pass the native gridded elevations before differentiating. The
    # filter removes raster quantization and shot-scale variation while
    # retaining crater rims and regional relief visible in the global DTM.
    smooth_elevation = gaussian_filter(
        elevation_km, sigma=1.15, mode=("nearest", "wrap")
    )

    # Derive tangent-space normals from LOLA height gradients, using local
    # east/south ground spacing for the equirectangular longitude/latitude grid.
    radius_km = 1737.4
    delta_lon = 2 * np.pi / width
    delta_lat = np.pi / height
    latitude = np.linspace(np.pi / 2, -np.pi / 2, height, dtype=np.float32)
    east_spacing = radius_km * np.maximum(np.cos(latitude), 0.035) * delta_lon
    south_spacing = radius_km * delta_lat
    dh_east = np.gradient(smooth_elevation, axis=1) / east_spacing[:, None]
    dh_south = np.gradient(smooth_elevation, axis=0) / south_spacing
    nx = -dh_east
    ny = -dh_south
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normals = np.stack(
        (
            np.clip(nx / length * 0.5 + 0.5, 0, 1),
            np.clip(ny / length * 0.5 + 0.5, 0, 1),
            np.clip(nz / length * 0.5 + 0.5, 0, 1),
        ),
        axis=-1,
    )
    normal_rgb = np.round(normals * 255).astype(np.uint8)
    Image.fromarray(normal_rgb).save(
        TEXTURES / "lunar-normal-lola.png", optimize=True
    )

    print("Wrote NASA LROC 8K albedo, LOLA 16ppd elevation, and derived normal maps")
    for path in sorted(TEXTURES.glob("lunar-*")):
        print(f"{path.name}: {path.stat().st_size / (1024 * 1024):.1f} MiB")


if __name__ == "__main__":
    main()
