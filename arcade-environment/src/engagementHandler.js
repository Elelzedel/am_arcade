export default class EngagementHandler {
	constructor(controls, activeCabinet) {
		const instructionsDiv = document.createElement("div");
		instructionsDiv.style.width = "100%";
		instructionsDiv.style.height = "100%";
		instructionsDiv.style.display = "flex";
		instructionsDiv.style.flexDirection = "column";
		instructionsDiv.style.justifyContent = "center";
		instructionsDiv.style.alignItems = "center";
		instructionsDiv.style.textAlign = "center";
		instructionsDiv.style.fontSize = "1vw";

		instructionsDiv.innerHTML = `
			<h2>Click inside screen to play<h2>
			Movement - WASD or IJKL<br\>
			Activate cabinet - Enter<br\>
			Exit game - Q<br\>
			Release mouse - ESC<br\>
		`;

		this.engagementDiv = document.createElement("div");
		this.engagementDiv.style.position = "absolute";
		this.engagementDiv.style.width = "100%";
		this.engagementDiv.style.height = "100%";
		this.engagementDiv.style.backgroundColor = "#00000055";
		this.engagementDiv.style.color = "#FFFFFF";

		this.engagementDiv.appendChild(instructionsDiv);

		document.body.appendChild(this.engagementDiv);

		this.engagementDiv.addEventListener("click", async () => {
			controls.lock();
			this.engagementDiv.style.display = "none";
		});

		// Create a special re-engagement message for when in-game
		this.reEngagementDiv = document.createElement("div");
		this.reEngagementDiv.style.position = "fixed";
		this.reEngagementDiv.style.top = "0";
		this.reEngagementDiv.style.left = "0";
		this.reEngagementDiv.style.width = "100%";
		this.reEngagementDiv.style.height = "100%";
		this.reEngagementDiv.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
		this.reEngagementDiv.style.color = "#FFFFFF";
		this.reEngagementDiv.style.display = "none";
		this.reEngagementDiv.style.flexDirection = "column";
		this.reEngagementDiv.style.justifyContent = "center";
		this.reEngagementDiv.style.alignItems = "center";
		this.reEngagementDiv.style.textAlign = "center";
		this.reEngagementDiv.style.fontSize = "1.5vw";
		this.reEngagementDiv.style.zIndex = "9999";
		this.reEngagementDiv.style.cursor = "pointer";

		this.reEngagementDiv.innerHTML = `
			<div>
				<h2>Mouse Released</h2>
				<p>Click to re-engage mouse control</p>
				<p style="font-size: 0.8em; margin-top: 20px;">Press Q to exit the game</p>
			</div>
		`;

		document.body.appendChild(this.reEngagementDiv);
		console.log('Re-engagement div created and appended');

		// Handle click on re-engagement div
		this.reEngagementDiv.addEventListener("click", () => {
			console.log('Re-engagement div clicked');
			controls.lock();
			this.reEngagementDiv.style.display = "none";
		});

		// Show engagement div again when pointer lock is lost
		controls.addEventListener('unlock', () => {
			console.log('Pointer lock lost. Active cabinet:', activeCabinet);
			if (activeCabinet) {
				// Show re-engagement div when in a game
				console.log('Showing re-engagement div');
				this.reEngagementDiv.style.display = "flex";
			} else {
				// Show normal engagement div when not in a game
				console.log('Showing normal engagement div');
				this.engagementDiv.style.display = "block";
			}
		});

		// Hide re-engagement div when pointer lock is acquired
		controls.addEventListener('lock', () => {
			console.log('Pointer lock acquired');
			this.reEngagementDiv.style.display = "none";
			
			// Keep controls disabled if in a game
			if (activeCabinet) {
				controls.enabled = false;
			}
		});
	}
}
