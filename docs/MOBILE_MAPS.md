# Mobile map interaction

The atlas follows the documented Google Maps / Mapbox mobile gesture vocabulary:

- One-finger drag pans; a tap selects a region or marker.
- Pinching two fingers zooms.
- Twisting two fingers rotates the 3D map.
- Moving two fingers vertically together tilts the 3D map.
- Double-tapping zooms in. The visible zoom, reset, tilt and north controls remain available.

References: [Google Maps Android controls](https://developers.google.com/maps/documentation/android-sdk/controls), [Mapbox GL JS gestures](https://docs.mapbox.com/mapbox-gl-js/guides/user-interactions/gestures/). Tilt direction and embedded-web cooperative scrolling differ between providers; these references establish the gesture vocabulary rather than identical implementations. The map handles gestures inside its viewport; the page remains scrollable outside it.

## Gesture separation

`MapTouchGestures` coalesces per-finger pointer events, waits for meaningful separation/angle/centroid movement, then locks one intent until the pair ends. Native MapControls handles one-finger pan and mouse input; pair gestures are not also processed as native orbit events. Pinch changes distance, twist changes bearing, and parallel vertical movement changes pitch independently. Cancellation and disposal restore control settings. Tap selection is delayed briefly so a double-tap can zoom without opening a region first.

## Responsive viewports

Both map modes inherit the same responsive viewport-height token. The 2D SVG fills that viewport in both dimensions: its intrinsic aspect ratio no longer creates a short, separately clipped drawing band inside a tall container. SVG coordinate transforms account for letterboxing during pan and pinch, preserving the archipelago's aspect ratio rather than stretching it. The 3D drawing buffer tracks its container through ResizeObserver. Home framing adapts to a resized viewport; an intentional pan/zoom is preserved.
