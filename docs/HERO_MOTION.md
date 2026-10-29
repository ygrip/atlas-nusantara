# Hero clay motion assets

Generated with the user-approved imagegen CLI fallback, `gpt-image-2`, medium quality, 2048×1024, using each existing `static/illustrations/hero/<id>.webp` as an edit reference. Each sheet has eight 512×512 poses in a 4×2 grid. Raw sheets are kept locally in `output/imagegen/hero-motion/`; release assets are transparent eight-frame WebP strips in `static/illustrations/hero/motion/`. Frame dimensions match their maximum display size: 96–192px for 1x displays and 192–256px for high-density displays, with the same eight-pose aspect ratio.

Process with `uv run --with pillow --with numpy python scripts/prepare-hero-sprites.py`. This removes the magenta background, corrects the orangutan's inconsistent third pose, and prints alignment values for `src/lib/hero/sprites.ts`. The runtime predecodes these assets only after window.load, then moves the strip with finite CSS stepped transform animation. All seven ornaments use the same sprite renderer. Matching `srcset` values in the predecoder and markup select just one density: about 204 KiB of motion strips on 1x displays or 441 KiB on high-density displays (previously 599 KiB for everyone). The flag plays its first four hoist poses once, then loops its four raised/waving poses during the anthem. Sound sources and adaptations are documented in `static/audio/hero/CREDITS.md`.

## Responsive cutouts

Run `uv run --with pillow python scripts/optimize-hero-cutouts.py --source-revision 1780632` to reproduce the static 1x/2x cutouts. The immutable Git input avoids repeatedly re-encoding lossy outputs. Maximum 2x widths are 128–176px, matching the largest ornaments in the 1280px page shell; 1x widths are half those values. The seven selected cutouts total about 24 KiB on 1x displays or 54 KiB on high-density displays. Both static and motion assets retain transparent WebP and their existing alignment, finite animation, and click-only audio.

## Generation command

Use the installed skill's bundled CLI with the corresponding prompt below saved to a text file:

```sh
uv run --with openai --with pillow python "$IMAGE_GEN" edit \
  --model gpt-image-2 --image "static/illustrations/hero/<id>.webp" \
  --prompt-file <prompt-file> --size 2048x1024 --quality medium --no-augment \
  --out "output/imagegen/hero-motion/<id>-sheet.png"
```

`OPENAI_API_KEY` must be configured locally; never put it in source control or command arguments.

## tiger

```text
Use case: precise-object-edit.
Input image: exact character reference, preserve identity.
Asset type: 8-frame clay stop-motion animation sprite sheet for a tiny interactive website ornament.
Create exactly EIGHT equally sized square cells, FOUR columns by TWO rows, on a uniform flat pure magenta #ff00ff background. Output 2048x1024. Each cell is 512x512. Read frames left-to-right top row, then left-to-right bottom row. No grid lines, text, numbers, floor, contact shadows, borders or extra objects. Same camera, scale, colors, materials, lighting and fixed foot/ground anchor in EVERY cell. Full subject visible with at least 40px safe margin in each cell. Soft matte plasticine clay like reference; warm top-left light. Preserve exact character identity, tiger stripe pattern, rounded face, adorable proportions and orientation facing viewer-left. Smooth successive key poses; frames1 and8 almost the same. No ghosting, blur, extra legs or duplicate parts.
Action: this exact friendly baby Sumatran tiger gives one playful big roar, then settles. Frame1 neutral mouth closed;2 head lifts slightly and mouth begins opening;3 jaw opens wider with tiny cream fangs visible and pink tongue;4 mouth fully open roar with eyes gently narrowed;5 warm playful roar peak, chest expands very subtly;6 jaw starts closing;7 relaxed open-mouth smile;8 neutral mouth almost closed. Feet and torso remain planted and the face never changes identity. Keep the tail shape and stripe pattern consistent. This is a cute friendly roar, not an aggressive scary tiger. No drawn sound rays, words, speech bubbles or starbursts.
```

## orangutan

```text
Use case: precise-object-edit.
Input image: the exact character/prop reference to preserve.
Asset type: 8-frame clay stop-motion animation sprite sheet for a tiny interactive website ornament.
Create exactly EIGHT equally sized square cells, FOUR columns by TWO rows, on a uniform flat pure magenta #ff00ff background. Output 2048x1024. Each cell is 512x512. Read frames left-to-right top row, then left-to-right bottom row. No grid lines, text, numbers, floor, contact shadows, borders or extra objects. Each frame has the SAME camera, scale, colors, materials, lighting and fixed body/ground anchor. Full subject visible with at least 40px safe margin inside each cell. Soft matte plasticine clay like the reference, warm top-left light. Preserve exact character identity, proportions, expression and orientation. Smooth successive key poses for a seamless animation loop; frames 1 and 8 are almost the same. Keep the torso absolutely still; only the named parts move. No ghost images, no motion blur, no duplicate limbs.
Action: The same seated friendly orange baby orangutan waves hello with its viewer-left arm. Frame1 arm hanging naturally; 2 lift elbow with hand at chest; 3 bend elbow with open palm beside ear; 4 open palm above head angled outward; 5 open palm above head angled inward; 6 palm beside ear; 7 lower elbow to chest; 8 hand almost resting. The waving arm remains naturally connected at the shoulder. Cute cheerful open smile, body and face do not morph.
```

## komodo

```text
Use case: precise-object-edit.
Input image: the exact character/prop reference to preserve.
Asset type: 8-frame clay stop-motion animation sprite sheet for a tiny interactive website ornament.
Create exactly EIGHT equally sized square cells, FOUR columns by TWO rows, on a uniform flat pure magenta #ff00ff background. Output 2048x1024. Each cell is 512x512. Read frames left-to-right top row, then left-to-right bottom row. No grid lines, text, numbers, floor, contact shadows, borders or extra objects. Each frame has the SAME camera, scale, colors, materials, lighting and fixed body/ground anchor. Full subject visible with at least 40px safe margin inside each cell. Soft matte plasticine clay like the reference, warm top-left light. Preserve exact character identity, proportions, expression and orientation. Smooth successive key poses for a seamless animation loop; frames 1 and 8 are almost the same. Keep the torso absolutely still; only the named parts move. No ghost images, no motion blur, no duplicate limbs.
Action: The same friendly sage-green komodo facing left stays planted. Its tail sweeps naturally side-to-side along a shallow curved arc, smoothly flexing rather than rotating as a rigid piece. Its forked pink tongue emerges from the mouth in frames3-5, extends toward the left, and retracts in6-7. Frame1 neutral tail and tongue hidden;2 tail curves outward;3 tongue half out tail left;4 tongue fully out tail reaches left;5 tongue fully out tail right;6 tongue retracts tail right;7 tongue hidden tail returns;8 neutral. Keep eyes, head, feet and body exactly stable.
```

## volcano

```text
Use case: precise-object-edit.
Input image: the exact character/prop reference to preserve.
Asset type: 8-frame clay stop-motion animation sprite sheet for a tiny interactive website ornament.
Create exactly EIGHT equally sized square cells, FOUR columns by TWO rows, on a uniform flat pure magenta #ff00ff background. Output 2048x1024. Each cell is 512x512. Read frames left-to-right top row, then left-to-right bottom row. No grid lines, text, numbers, floor, contact shadows, borders or extra objects. Each frame has the SAME camera, scale, colors, materials, lighting and fixed body/ground anchor. Full subject visible with at least 40px safe margin inside each cell. Soft matte plasticine clay like the reference, warm top-left light. Preserve exact character identity, proportions, expression and orientation. Smooth successive key poses for a seamless animation loop; frames 1 and 8 are almost the same. Keep the torso absolutely still; only the named parts move. No ghost images, no motion blur, no duplicate limbs.
Action: The same small sage-green clay volcano with red crater erupts. Mountain is fixed and absolutely still, no shaking or body changes. The existing pale smoke plume develops gradually into soft rounded charcoal-and-warm-gray clay smoke puffs rising above the crater, with a small glowing orange lava fountain and a few rounded glowing embers following curved arcs, falling back toward the crater. Frame1 quiet original pale plume;2 plume swells orange vent;3 short lava spout;4 warm orange lava fountain and puffy ash;5 fountain peaks;6 lava falls and ash drifts;7 activity subsides;8 original quiet plume. Leave plenty of headroom in every frame. No thin drawn graphic lines, photoreal fire or explosive starbursts.
```

## pinisi

```text
Use case: precise-object-edit.
Input image: the exact character/prop reference to preserve.
Asset type: 8-frame clay stop-motion animation sprite sheet for a tiny interactive website ornament.
Create exactly EIGHT equally sized square cells, FOUR columns by TWO rows, on a uniform flat pure magenta #ff00ff background. Output 2048x1024. Each cell is 512x512. Read frames left-to-right top row, then left-to-right bottom row. No grid lines, text, numbers, floor, contact shadows, borders or extra objects. Each frame has the SAME camera, scale, colors, materials, lighting and fixed body/ground anchor. Full subject visible with at least 40px safe margin inside each cell. Soft matte plasticine clay like the reference, warm top-left light. Preserve exact character identity, proportions, expression and orientation. Smooth successive key poses for a seamless animation loop; frames 1 and 8 are almost the same. Keep the torso absolutely still; only the named parts move. No ghost images, no motion blur, no duplicate limbs.
Action: The same brown pinisi sailing ship with cream sails rides on an animated cushion of softly sculpted mint/turquoise clay water UNDER its hull. The ship and sails stay unchanged and shift only slightly together as a boat riding a swell. Small rounded white foam crests move smoothly from right to left beneath hull. Frame1 neutral;2 water rises on right and ship rocks slightly left;3 swell under center and ship lifted subtly;4 swell travels left and ship tilts subtly right;5 neutral;6 opposite swell;7 settles;8 near neutral. Water remains low under hull, with no extra islands, giant waves or splashes over boat.
```

## cendrawasih

```text
Use case: precise-object-edit.
Input image: the exact character/prop reference to preserve.
Asset type: 8-frame clay stop-motion animation sprite sheet for a tiny interactive website ornament.
Create exactly EIGHT equally sized square cells, FOUR columns by TWO rows, on a uniform flat pure magenta #ff00ff background. Output 2048x1024. Each cell is 512x512. Read frames left-to-right top row, then left-to-right bottom row. No grid lines, text, numbers, floor, contact shadows, borders or extra objects. Each frame has the SAME camera, scale, colors, materials, lighting and fixed body/ground anchor. Full subject visible with at least 40px safe margin inside each cell. Soft matte plasticine clay like the reference, warm top-left light. Preserve exact character identity, proportions, expression and orientation. Smooth successive key poses for a seamless animation loop; frames 1 and 8 are almost the same. Keep the torso absolutely still; only the named parts move. No ghost images, no motion blur, no duplicate limbs.
Action: The same golden-yellow clay cendrawasih, perched in the SAME spot on its little gray-green stump, flaps BOTH anatomical wings. The near wing opens from shoulder out toward viewer-right, showing long layered gold/orange flight feathers; the far wing is seen behind body on viewer-left. Frame1 wings tucked;2 wings half open;3 wings fully open and raised;4 wings downstroke half down;5 wings open low;6 wings rising half open;7 wings nearly tucked;8 wings tucked. Feet, eyes, beak, crest, torso, perch, long hanging orange tail and plant are fixed and do not morph. No bird lift, extra wings, arm-like or detached pieces.
```

## flag

```text
Use case: precise-object-edit.
Input image: exact red-white Indonesian clay flag reference, preserve prop identity.
Asset type: 8-frame clay stop-motion animation sprite sheet for a tiny interactive website ornament.
Create exactly EIGHT equally sized square cells, FOUR columns by TWO rows, on a uniform flat pure magenta #ff00ff background. Output 2048x1024. Each cell is 512x512. Read frames left-to-right top row then left-to-right bottom row. No grid, text, numbering, borders, ground, contact shadows, extra symbols or people. Same camera, scale, colors, soft matte plasticine materials and warm upper-left lighting in every cell. Keep the light sage-green flagpole, small round gold finial and rounded beige pedestal EXACTLY fixed in every cell. Full prop visible with 40px safe margin inside each square. This is the flag of Indonesia: TWO horizontal equal bands, RED ABOVE WHITE in EVERY pose. Never invert colors. Cloth remains connected to pole at its left edge; show natural soft rounded clay folds, not thin fabric or a flat vector.
Frames1-4 show ONE ceremonial hoist: 1 cloth at lower-middle of pole, 2 cloth a little higher, 3 cloth nearly at pole top, 4 cloth fully raised immediately under finial. The pole and base never move. Frames5-8 show a seamless waving cycle fully raised: 5 cloth gently billows toward viewer, 6 cloth gently folds away, 7 cloth billows again, 8 cloth returns near pose5. Only the cloth moves. Preserve the exact original flagpole and pedestal silhouette and proportions; do not add stripes, tassels, ropes, stars, extra poles, arms or decorative rays.
```
