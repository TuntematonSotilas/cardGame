import * as BABYLON from "babylonjs";
import { GroundBuilder } from "../builders/ground-builder";
import { UnitBuilder } from "../builders/unit-builder";
import { DeckBuilder } from "../builders/deck-builder";
import { StatusBuilder } from "../builders/status-builder";
import { CameraBuilder } from "../builders/camera-builder";
import { AIManager } from "../ai/ai-manager";
import { Maps } from "../datas/maps";
import { User } from "../datas/user";

export class Game {

	/** BabylonJS */
	private canvas: HTMLCanvasElement;
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene;
	private camera: BABYLON.ArcRotateCamera;
	/** If the camera is free */
	private isFreeCamera: boolean = true;
	/** Map size */
	private mapSize: string;

	/** AI */
	private aiManager: AIManager;

	/** Builders */
	private groundBuilder: GroundBuilder;
	private unitBuilder: UnitBuilder;
	private deckBuilder: DeckBuilder;
	private cameraBuilder: CameraBuilder;

	constructor(canvasElement : string, mapSize: string) {
		this.mapSize = mapSize;
		// Create canvas and engine
		this.canvas = document.getElementById(canvasElement) as HTMLCanvasElement;
		this.engine = new BABYLON.Engine(this.canvas, true);
		this.engine.disableManifestCheck = true;
		// Create the scene
		this.createScene();
		// Start render loop
		this.doRender();
	}

	private createScene() : void {
		// Create a basic BJS Scene object.
		this.scene = new BABYLON.Scene(this.engine);

		// Create a rotating camera
		this.camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI/2, Math.PI/4, 8, BABYLON.Vector3.Zero(), this.scene);
		// Zoom limit
		this.camera.lowerRadiusLimit = 2;
		this.camera.upperRadiusLimit = 30;
		// Prevent rotate
		this.switchFreeCamera();

		// Attach the camera to the canvas.
		this.camera.attachControl(this.canvas, false);
	
		// Create a basic light, aiming 0,1,0 - meaning, to the sky.
		new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0,1,0), this.scene);
	
		// Create the ground
		console.log(this.mapSize)
		this.groundBuilder = new GroundBuilder(this.scene, Maps.maps[this.mapSize]);

		// Center camera on ground 
		let meshCenter: BABYLON.Vector3 = this.groundBuilder.ground.getBoundingInfo().boundingBox.centerWorld;
		let size: BABYLON.Vector3 =  this.groundBuilder.ground.getBoundingInfo().boundingBox.extendSizeWorld; 
		let maxSize: number = size.x>size.z?size.x:size.z;
		this.camera.setTarget(meshCenter);
		let ratio: number = this.engine.getAspectRatio(this.camera);
    	let h: number = maxSize / (Math.tan (this.camera.fov / 2) * ratio);
		this.camera.setPosition(new BABYLON.Vector3(meshCenter.x, meshCenter.y +h, meshCenter.z+ maxSize*3));
		this.camera.beta = Math.PI/4;

		//AI
		this.aiManager = new AIManager(this.groundBuilder.frontLineEnemy.position.z);

		//User
		let user: User = new User("YOU", 10, 10, false);
		let enemey: User = new User("ENEMY", 10, 10, true);

		//Builders
		this.cameraBuilder = new CameraBuilder(this.switchFreeCamera);
		let statusBuilder : StatusBuilder = new StatusBuilder(this.scene, user, enemey);
		this.unitBuilder = new UnitBuilder(this.scene);
		this.deckBuilder = new DeckBuilder(
			user,
			this.aiManager.playACard, 
			this.unitBuilder.attack, 
			this.groundBuilder.moveFrontLine,
			statusBuilder.updateBar);
		
		//AI
		this.aiManager.callBackPlaceUnit = this.unitBuilder.placeUnit;
		this.aiManager.callBackEndAITurn = this.deckBuilder.endAITurn;
		this.aiManager.zFrontLine = this.groundBuilder.frontLineEnemy.position.z;
	}

	/** Click on a tile */
	private chooseTile() {
		let pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);	
		if (pickResult.faceId > 0) {
			let position: BABYLON.Vector3 = pickResult.pickedPoint.subtract(this.groundBuilder.ground.position);

			let zFrontLine: number = this.groundBuilder.frontLineUser.position.z;
			this.unitBuilder.placeUnit(this.deckBuilder.cardSelected, position, true, zFrontLine).then(() => {
				this.deckBuilder.removeCard(this.deckBuilder.cardSelected);	
			}).catch(() => {});
		}
	}

	private doRender() : void {
		// Run the render loop.
		this.engine.runRenderLoop(() => {
			this.scene.render();
		});

		// The canvas/window resize event handler.
		window.addEventListener("resize", () => {
			this.engine.resize();
		});

		window.addEventListener("pointermove", () => {
			if (this.deckBuilder.isDragging) {
				if (this.isFreeCamera) {
					this.cameraBuilder.switchFreeCamera();
				}
				this.groundBuilder.showCurrentTile();
				this.deckBuilder.showCardDrag(this.scene.pointerX, this.scene.pointerY);
			}
		});

		window.addEventListener("pointerup", () => {
			if (this.deckBuilder.isDragging) {
				this.deckBuilder.isDragging = false;
				this.deckBuilder.removeDragCard();
				this.chooseTile();
				this.groundBuilder.hideOrShowSelector("OK", 0);
				this.groundBuilder.hideOrShowSelector("KO", 0);
			}
		});
	}

	public switchFreeCamera = () => {
		if (this.isFreeCamera) {
			// Prevent rotate
			this.camera.lowerBetaLimit = Math.PI/4;
			this.camera.upperBetaLimit =  Math.PI/4;
			this.camera.lowerAlphaLimit = -Math.PI/2;
			this.camera.upperAlphaLimit = -Math.PI/2;
		} else {
			// Activate rotate
			this.camera.lowerBetaLimit = null;
			this.camera.upperBetaLimit =  null;
			this.camera.lowerAlphaLimit = null;
			this.camera.upperAlphaLimit = null;
		}
		this.isFreeCamera = !this.isFreeCamera;
	}
}