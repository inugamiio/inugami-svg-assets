export interface SvgAssetSet {
    name: string;
    assets: SvgAsset[];
}

export interface SvgAsset {
    name: string;
    types: SvgAssetType[];
    attributes ?: SvgAssetAttribute[];
}

export interface SvgAssetType {
    name: string;
    states : SvgAssetState[];
}
export interface SvgAssetState {
    name: string;
    content : string;
}
export interface SvgAssetAttribute {
    name: string;
    value : string;
}