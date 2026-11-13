# LunaNav

A full-screen lunar exploration prototype based on the supplied screen recording. It uses a live Three.js Moon scene, responsive landing-site panels, a simplified lighting/visibility model, and a mission timeline.

## Run locally

Install dependencies and start the Vite development server:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. The globe uses the NASA LRO CGI Moon Kit 8K LROC WAC mosaic for albedo and LOLA 16-pixel-per-degree global elevation for height and derived tangent-space normals. Earth uses NASA's Blue Marble global land, ocean, ice, and cloud mosaic. These maps ship locally, so the scene does not depend on runtime texture CDNs. NASA describes the Moon color mosaic as appearance-oriented and notes that polar fill is lower resolution; it is not a substitute for site-scale science products. Build the production app with `npm run build`.

Texture sources: [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) and [NASA Blue Marble](https://svs.gsfc.nasa.gov/2915/). `scripts/build-lunar-textures.py` downloads and converts the lunar TIFFs; it requires Pillow, NumPy, and SciPy.

## Scene scale and Earth model

The lunar surface radius is 1.34 scene units, matching 1,737.4 km. Earth uses the same scale: radius 6,371 km and center separation 384,400 km (about 296.4 scene units), giving a 1.90° apparent diameter. Earth, stars, and the Sun direction are siblings of the interactive lunar group, so mouse camera motion does not rotate or reposition them. Mission time updates Earth placement through LunaNav's simplified lunar libration model and advances its surface rotation. The model is illustrative and is not driven by SPICE or JPL Horizons kernels.

## Interaction

- Drag the Moon to rotate; scroll to zoom.
- Pick a landing region in the left panel or click a visible marker.
- Scrub the mission timeline, step by one hour, or play at 1×–1000×.
- Use the top controls or floating toolbar to focus/reset the camera and toggle relief, illumination, Earth visibility, and fullscreen.
- Open **Compare all** or **Analysis** for current-time site comparisons. **Settings** explains the visualization model.
- Space toggles playback; `F` focuses the selected site.

Telemetry is a geometric preview based on a simplified lunar day and libration model. It is not validated NASA ephemeris or terrain-occlusion data. Positive Earth elevation indicates geometric line of sight only; the interface does not claim terrain clearance.
