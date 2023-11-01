import { gsap } from "gsap";
import * as THREE from 'three';
import Scroll from './scroll.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import ovpFragment from './shaders/ovpFragment.glsl';
import ovpVertex from './shaders/ovpVertex.glsl';

import scrollFragment from './shaders/scrollFragment.glsl';
import scrollVertex from './shaders/scrollVertex.glsl';

import { content, footer, header, iconRotate, navigationToSmall } from "~/utils/animations";

const CanvasOptions = {
    scroll: {
        fragmentShader: scrollFragment,
        vertexShader: scrollVertex,
    },
    default: {
        fragmentShader: ovpFragment,
        vertexShader: ovpVertex,
    },
};
let Canvas = {
    navigation: null,
    scrollInProgress : false,
    canvasContainer : null,
    scrollableContent : null,
    pointer : {cursor: null , intersects: null },
    time: 0,
    scene: new THREE.Scene(),
    materials: [],
    imageStore: [],
    trackViewPortElements:[],
    scroll: null,
    currentScroll: 0,
    options : CanvasOptions,
    animations: {
        welcome: {},
        curtain: {},
        cursorCallBack: () => {},
    },
    initScroll(){
        this.scroll = new Scroll({
            dom: this.scrollableContent,
            activeCallback: this.activateImage,
        });
    },
    setCanvasAndCamera(){
        this.width = this.canvasContainer.offsetWidth;
        this.height = this.canvasContainer.offsetHeight;

        this.camera = new THREE.PerspectiveCamera( 70, this.width/this.height, 100, 2000 );
        this.camera.position.z = 600; // 600
        this.camera.fov = 2 * Math.atan( (this.height/2)/600 ) * (180/Math.PI);

        this.renderer = new THREE.WebGLRenderer({
            alpha: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio , 1.5));
        this.canvasContainer.appendChild( this.renderer.domElement );
    },
    init(_canvasElement, _scrollableContent) {

        this.canvasContainer = _canvasElement;
        this.scrollableContent = _scrollableContent;

        this.initScroll()

        this.setCanvasAndCamera()

        this.setSize();
        this.composerPass();
        this.curtainInit();

        this.setResizeListener()

        this.render();
    },
    setResizeListener(){
        window.addEventListener("resize", () => {

            this.width = this.canvasContainer.offsetWidth;
            this.height = this.canvasContainer.offsetHeight;

            this.setSize();
            this.animations.curtain.mesh.scale.set( window.innerWidth , 0 );

           this.resizeImageStore()

        })
    },
    resizeImageStore(){
        // all meshes should be resized to new size
        for (var i = 0; i < this.imageStore.length; i++) {
            let bounds = this.imageStore[i].img.getBoundingClientRect();
            this.imageStore[i].mesh.scale.set(bounds.width , bounds.height)
            this.imageStore[i].width = bounds.width;
            this.imageStore[i].height = bounds.height;
        }
        this.setImageMeshPositions()
    },
    setImageMeshPositions(){
        if(!this.imageStore) return;
        for (var i = 0; i < this.imageStore.length ; i++) {
            this.imageStore[i].mesh.position.x = ( this.imageStore[i].img.getBoundingClientRect().left - this.width/2 + this.imageStore[i].width/2);
            this.imageStore[i].mesh.position.y =  - this.imageStore[i].img.getBoundingClientRect().top + this.height/2 - this.imageStore[i].height/2;
        }
    },

    hoverImage(_id, _state) {
        const mesh = this.scene.getObjectByName(_id);
        if(!mesh) return;
        gsap.to(mesh.material.uniforms.hoverState , {
            duration: 0.5,
            value: _state ? 1 : 0,
        })
    },

    activateImage(_id, _state) {
        const mesh = this.scene.getObjectByName(_id);
        gsap.to(mesh.material.uniforms.aniIn , {
            duration: 1.25,
            value: _state ? 1 : 0,
        })
    },

    onActiveElCallback(_item, _active){
        if(_item.options.includes('header')) header(_item , _active)
        if(_item.options.includes('content')) content(_item , _active)
        if(_item.options.includes('line')) line(_item , _active)
        if(_item.options.includes('navigationbgdark')) {
            if(!this.navigation) return
            if(_active){
                this.navigation.classList.add('ovp-navigation-light')
            }else{
                this.navigation.classList.remove('ovp-navigation-light')
            }
        }
        if(_item.options.includes('appbgdark')) {
            if(_active){
                _item.bgContainer.classList.add("dark");
            } else {
                _item.bgContainer.classList.remove("dark");
            }
        }
    },

    onScrollCallBack(_item, _scrollPosition, _scrollSpeed) {
        if(_item.options.includes('footer')) footer(_item , _scrollPosition)
        if(_item.options.includes('rotate')) iconRotate(_item, _scrollPosition,  _scrollSpeed)
    },

    navigationToSmall(_status) {
        if(window.innerWidth < 768) return
        if (_status) {
            if( !this.navigation.classList.contains('ovp-nav-small')){
                navigationToSmall(this.navigation, true);
                this.navigation.classList.add( 'ovp-nav-small' )
            }
        } else {
            if( this.navigation.classList.contains('ovp-nav-small')){
                navigationToSmall(this.navigation, false);
                this.navigation.classList.remove( 'ovp-nav-small' )
            }
        }

    },

    addScrollSpeedElement(_el){
        if(_el.options?.includes('fixed')){
            setTimeout(() => { // timeout for rendering when page is changed
                _el.containerId = _el.scrollSpeed
                _el.scrollSpeed = 1
                _el.bounds = _el.elNode.getBoundingClientRect()
                _el.containerEl = document.getElementById(_el.containerId)
                _el.childEl= _el.elNode.children[0]
                _el.containerBottom = _el.containerEl.getBoundingClientRect().bottom
                _el.margin = 60
                this.scroll.DOM.scrollspeed.push(_el);
            }, 750);
            return
        }
        this.scroll.DOM.scrollspeed.push(_el);
    },

    removeScrollSpeedElement(_elNode){
        if(this.scroll.DOM.scrollspeed.length === 0 || !_elNode ) return
        for (var i = 0; i < this.scroll.DOM.scrollspeed.length; i++) {
            if(this.scroll.DOM.scrollspeed[i].elNode.isEqualNode(_elNode)){
                this.scroll.DOM.scrollspeed.splice(i, 1);
                break;
            }
        }
    },

    removeScrollActiveElement(_elNode) {
        if(!_elNode || this.scroll.DOM.scrollactive.length === 0) return
        for (var i = 0; i < this.scroll.DOM.scrollactive.length; i++) {
            if(this.scroll.DOM.scrollactive[i].elNode.isEqualNode(_elNode)){
                if(this.scroll.DOM.scrollactive[i].options.includes('appbgdark')){
                   this.scroll.DOM.scrollactive[i].bgContainer.classList.remove("dark");
                }
                this.scroll.DOM.scrollactive.splice(i, 1);
                break;
            }
        }
    },

    addScrollActiveElement(_settings){
        _settings.containedMeshId = this.findMeshID(_settings.elNode, true);
        if(_settings.options.includes('header')) _settings.elNode.classList.add('ovp-title-overflow')
        if(_settings.options.includes('top')) _settings.rangeFromTop = true;
        if(_settings.options.includes('once')) _settings.aniInOnly = true;
        if(_settings.options.includes('navigationbgdark')) _settings.navigationLight = true;
        if(_settings.options.includes('appbgdark')) _settings.bgContainer = document.querySelector('#appContainer')
        // if(_settings.options.includes('appbgdark')) _settings.bgContainer = document.querySelector('#scrollContainer')
        this.scroll.DOM.scrollactive.push(_settings);
        this.onActiveElCallback(_settings, false)
    },

    findMeshID(_elParent, _isActiveScroll){
        if(_elParent.dataset.meshId) {
            _elParent.dataset.scrollActive = "true";
            return _elParent.dataset.meshId;
        }

        let el = _elParent.querySelector("[data-mesh-id]");
        if(!el) return false;

        el.dataset.scrollActive = _isActiveScroll ? "true" : undefined;
        return el.dataset.meshId;
    },

    removeImageMesh(_id){
        let toRemove = this.scene.getObjectByName(_id);
        if(!toRemove) return;
        this.scene.remove(toRemove);
        toRemove.geometry.dispose();
        toRemove.material.dispose();
        toRemove = undefined;

        for (var i = 0; i < this.imageStore.length; i++) {
            if(this.imageStore[i].name === _id){
                this.imageStore.splice(i, 1);
                this.materials.splice(i, 1);
                break;
            }
        }
    },

    addImageAsMesh(_img, _shader, _meshId, _mouseListeners) {

        let fragmentShader= this.options.default.fragmentShader;
        let vertexShader = this.options.default.vertexShader;

        if(_shader){
            fragmentShader = this.options[_shader].fragmentShader;
            vertexShader = this.options[_shader].vertexShader;
        }

        let geometry;
        let bounds = _img.getBoundingClientRect();
        let position = { top : bounds.top , left: bounds.left};
        position.top += this.currentScroll;

        geometry = new THREE.PlaneGeometry( 1, 1 );
        // geometry = new THREE.PlaneGeometry( bounds.width , bounds.height );
        // const geometry = new THREE.PlaneGeometry( 1, 1);


        let _id = _meshId ? _meshId : `meshImage_${ _shader || "default" }_${this.imageStore.length}`;
        _img.dataset.meshId = _id;

        let texture = new THREE.TextureLoader().load( _img.src );
        texture.needsUpdate = true;

        let material = new THREE.ShaderMaterial({
            uniforms:{
                time: {value:0},
                uImage: {value: texture},
                vectorVNoise: {value: new THREE.Vector2( 1.5 , 1.5 )}, // 1.5
                hoverState: {value: 0},
                aniIn: {value: 0},
            },
            fragmentShader: fragmentShader,
            vertexShader: vertexShader,
            transparent: true,
            name: _id,
        });

        this.materials.push(material);

        let mesh = new THREE.Mesh( geometry, material );
        mesh.name =  _id;

        mesh.scale.set(bounds.width , bounds.height)

        this.scene.add(mesh);

        const newMesh = {
            name: _id,
            img: _img,
            mesh: mesh,
            top: position.top,
            left: position.left,
            width: bounds.width,
            height: bounds.height,
            thumbOutAction: {value: 0},
        }

        this.imageStore.push(newMesh);

        setTimeout(() => {
            if(!_img.dataset.scrollActive) this.activateImage(_id, true);
        },250)

        this.setImageMeshPositions();
        if(_mouseListeners)
        this.meshMouseListeners(newMesh, material);
    },

curtainInit(){
    const geometry = new THREE.PlaneGeometry( 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: '#172d4a' });
    const rectangle = new THREE.Mesh(geometry, material);
    rectangle.name = 'curtain'

    this.animations.curtain.settings = {
        position: - window.innerHeight / 2,
    }
    rectangle.position.set(0,this.animations.curtain.settings.position)
    rectangle.scale.set(window.innerWidth ,1)
    this.scene.add(rectangle);
    this.animations.curtain.mesh = this.scene.getObjectByName(rectangle.name);
},

    curtainAnimation(_duration, _direction){

        this.animations.curtain.settings = {
            fullScreenPercent: 0.3,
            start: 1 ,
            duration: _duration / 2,
            position: - window.innerHeight / 2,
            current: 0,
            end: window.innerHeight,
        }

        this.animations.curtain.active = true;
    },

    meshMouseListeners(_mesh, _material) {

        _mesh.img.addEventListener('mouseenter',(event)=>{
            _mesh.mesh.renderOrder = 1;
            gsap.to(_material.uniforms.hoverState, {
                duration: 0.5,
                value:1
            })
        })

        _mesh.img.addEventListener('mouseout',()=>{
            _mesh.mesh.renderOrder = 0;
            gsap.to(_material.uniforms.hoverState,{
                duration: 0.5,
                value:0
            })
        })

    },
    composerPass(){
        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);

        this.myEffect = {
            uniforms: {
                "tDiffuse": { value: null },
                "scrollSpeed": { value: null },
            },
            vertexShader: this.options.scroll.vertexShader,
            fragmentShader: this.options.scroll.fragmentShader,
        }

        this.customPass = new ShaderPass(this.myEffect);
        this.customPass.renderToScreen = true;

        this.composer.addPass(this.customPass);
    },
    setSize(){
        this.width = this.canvasContainer.offsetWidth;
        this.height = this.canvasContainer.offsetHeight;

        this.camera.aspect = this.width/this.height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( this.width,this.height );
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.render(this.scene, this.camera); // -> Also needed
    },
    scrollToTop(_delay){
        setTimeout( () => {
            this.scroll.render( 0 , false );
        } , _delay)
    },

    curtainAnimationRender(currentTime) {

            if (!this.animations.curtain.settings.startTime) {
                this.animations.curtain.settings.startTime = currentTime;
            }
            let currentStep = this.animations.curtain.settings.current

            const elapsed = currentTime - this.animations.curtain.settings.startTime;
            const progressReal = Math.min(elapsed / this.animations.curtain.settings.duration, 1)
            let progressRender;

            const valAniUp = 0.5 - this.animations.curtain.settings.fullScreenPercent / 2
            const valAniDown = 0.5 + this.animations.curtain.settings.fullScreenPercent / 2
            if(progressReal <= valAniUp ){
                progressRender =  progressReal / valAniUp * 0.5
            }else if(progressReal > valAniUp && progressReal < valAniDown){
                progressRender = 0.5
            }else if(progressReal >= valAniDown){
                progressRender = (( progressReal - valAniDown) / valAniUp * 0.5) + 0.5
            }

            this.animations.curtain.settings.current = progressRender * this.animations.curtain.settings.end;

            this.animations.curtain.mesh.position.set(0, this.animations.curtain.settings.position + currentStep )

            if( progressRender < 0.5 ){
                this.animations.curtain.mesh.scale.set( window.innerWidth, currentStep * 2);
            }else {
                let reverseStep = currentStep - this.animations.curtain.settings.end
                this.animations.curtain.mesh.scale.set( window.innerWidth, reverseStep * 2 );
            }
            if(progressRender == 1) {
                this.animations.curtain.mesh.position.set( 0 , this.animations.curtain.settings.end )
                this.animations.curtain.mesh.scale.set( window.innerWidth, 0 );
                this.animations.curtain.active = false;
            }

    },

    render(currentTime) {
        this.animations.cursorCallBack()

        this.time+=0.05;

        this.scroll.render();
        this.scrollInProgress = this.currentScroll !== this.scroll.scrollToRender ;
        this.currentScroll = this.scroll.scrollToRender;

        //animate on scroll
        if( this.scrollInProgress){
            this.customPass.uniforms.scrollSpeed.value = this.scroll.speedTarget;
            this.setImageMeshPositions();
        }

        //animate on hover
        for (var i = 0; i < this.materials.length; i++) {
            this.materials[i].uniforms.time.value = this.time;
        }

        if(this.animations.curtain.active) {
           this.curtainAnimationRender(currentTime);
        }
        this.composer.render()

        try {
          requestAnimationFrame(this.render.bind(this));
        } catch (_) {
          setImmediate(this.render.bind(this));
        }
    },

}

export { Canvas };

