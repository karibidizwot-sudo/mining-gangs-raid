import{aC as t}from"./greasedLineBaseMesh-eo2IcIiT.js";import"./hero-asset-gq8uSJ8P.js";const e="volumetricLightingRenderVolumeVertexShader",o=`#include<sceneUboDeclaration>
#include<meshUboDeclaration>
attribute position : vec3f;varying vWorldPos: vec4f;@vertex
fn main(input : VertexInputs)->FragmentInputs {let worldPos=mesh.world*vec4f(vertexInputs.position,1.0);vertexOutputs.vWorldPos=worldPos;vertexOutputs.position=scene.viewProjection*worldPos;}
`;t.ShadersStoreWGSL[e]||(t.ShadersStoreWGSL[e]=o);const i={name:e,shader:o};export{i as volumetricLightingRenderVolumeVertexShaderWGSL};
