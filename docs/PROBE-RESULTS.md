# INKVERSE probe results

Run at 2026-09-17T17:13:58.828Z

## Keys present (names only)
- RUNWARE_API_KEY: present
- ANTHROPIC_API_KEY: present
- FABLE_5_1_KEY: MISSING

## Runware image probes
- flux-schnell-preview: OK model=runware:100@1 512x512 latency=2816ms cost=0.0006 task=9c983d63-90fb-4681-b59d-94f009375b2f -> data/probe/flux-schnell-preview.png
- flux-klein-preview: OK model=runware:400@4 512x512 latency=1109ms cost=0.0006 task=cd07b038-edf6-4424-8ec0-6d51546db797 -> data/probe/flux-klein-preview.png
- gpt-image-flare-final: OK model=openai:gpt-image@2.5-flare 1024x1024 latency=14331ms cost=0.006005 task=a39b1611-a205-4af5-9e98-47c9b2f859d8 -> data/probe/gpt-image-flare-final.png

## Anthropic director probe
- director: OK model=claude-fable-5-1 latency=20077ms cacheRead=0 cacheWrite=4158 in=278 out=1225 cost=unknown topLevelKeys=[beat,stateDelta,panels,choices,continuityNotes,summaryUpdate,ending]

