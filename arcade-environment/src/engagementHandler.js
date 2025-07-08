export default class EngagementHandler {
	static createElements(controls, activeCabinet) {
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

		const engagementDiv = document.createElement("div");
		engagementDiv.style.position = "absolute";
		engagementDiv.style.width = "100%";
		engagementDiv.style.height = "100%";
		engagementDiv.style.backgroundColor = "#00000055";
		engagementDiv.style.color = "#FFFFFF";

		engagementDiv.appendChild(instructionsDiv);

		document.body.appendChild(engagementDiv);

		engagementDiv.addEventListener("click", async () => {
			controls.lock();
			engagementDiv.style.display = "none";
		});

		// Create a special re-engagement message for when in-game
		const reEngagementDiv = document.createElement("div");
		reEngagementDiv.style.position = "fixed";
		reEngagementDiv.style.top = "0";
		reEngagementDiv.style.left = "0";
		reEngagementDiv.style.width = "100%";
		reEngagementDiv.style.height = "100%";
		reEngagementDiv.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
		reEngagementDiv.style.color = "#FFFFFF";
		reEngagementDiv.style.display = "none";
		reEngagementDiv.style.flexDirection = "column";
		reEngagementDiv.style.justifyContent = "center";
		reEngagementDiv.style.alignItems = "center";
		reEngagementDiv.style.textAlign = "center";
		reEngagementDiv.style.fontSize = "1.5vw";
		reEngagementDiv.style.zIndex = "9999";
		reEngagementDiv.style.cursor = "pointer";

		reEngagementDiv.innerHTML = `
			<div>
				<h2>Mouse Released</h2>
				<p>Click to re-engage mouse control</p>
				<p style="font-size: 0.8em; margin-top: 20px;">Press Q to exit the game</p>
			</div>
		`;

		document.body.appendChild(reEngagementDiv);
		console.log('Re-engagement div created and appended');

		// Handle click on re-engagement div
		reEngagementDiv.addEventListener("click", () => {
			console.log('Re-engagement div clicked');
			controls.lock();
			reEngagementDiv.style.display = "none";
		});

		// Show engagement div again when pointer lock is lost
		controls.addEventListener('unlock', () => {
			console.log('Pointer lock lost. Active cabinet:', activeCabinet);
			if (activeCabinet) {
				// Show re-engagement div when in a game
				console.log('Showing re-engagement div');
				reEngagementDiv.style.display = "flex";
			} else {
				// Show normal engagement div when not in a game
				console.log('Showing normal engagement div');
				engagementDiv.style.display = "block";
			}
		});

		// Hide re-engagement div when pointer lock is acquired
		controls.addEventListener('lock', () => {
			console.log('Pointer lock acquired');
			reEngagementDiv.style.display = "none";
			
			// Keep controls disabled if in a game
			if (activeCabinet) {
				controls.enabled = false;
			}
		});
	}
}
