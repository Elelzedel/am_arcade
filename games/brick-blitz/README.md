# BRICK BLITZ

A neon Breakout/Arkanoid-style cabinet game. Smash every breakable brick to clear the round. There are 10 handcrafted layouts (Pyramid, Invader, Heartbreaker, Checkmate, Fortress, Chain Reaction, Happy Face, Pillars, Bullseye...). After those, the rounds are procedurally generated and get harder as you go.

## Controls
| Key | Action |
| --- | --- |
| Left/Right arrows or A/D | Move paddle |
| Space | Launch the ball / release a caught ball |
| Hold Space | Fire twin lasers (Laser power-up) |
| P | Pause |

Where the ball hits the paddle sets its angle: the centre sends it straight up and the edges send it off at a steep angle. The ball speeds up the longer a round lasts.

## Bricks
- **Coloured**: one hit, worth 50-120 pts depending on colour.
- **Silver / steel**: need 2 / 3 hits and show cracks (150 / 250 pts).
- **Gold**: indestructible. You don't need to break them to clear a round.
- **Explosive** (striped, pulsing): destroys its neighbours and can set off other explosives (200 pts).

## Power-up capsules (about 12% of broken bricks drop one)
| Capsule | Effect |
| --- | --- |
| **E** (blue) | Expand paddle |
| **M** (cyan) | Multi-ball: splits into 3 balls |
| **L** (red) | Laser: hold Space to fire |
| **S** (orange) | Slow ball |
| **C** (green) | Catch: the ball sticks to the paddle |
| **P** (silver, rare) | Extra life |

Timed power-ups appear bottom right with a bar showing time left. They blink when they are about to run out.

## Scoring
- Each brick you break without touching the paddle raises the combo. Every 5 bricks adds +1 to the multiplier, up to X8.
- Catching a capsule is worth 500 pts.
- Clearing a round gives a bonus of 1000 × round number.
- You start with 3 lives and get an extra life every 20,000 pts.

## Tips
- Aim with the paddle edges to get the ball behind a brick wall and let it bounce around up there.
- Save explosive bricks for when they will set off a chain.
- Laser is the quickest way to finish off the last few bricks.
