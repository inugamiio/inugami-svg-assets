const FS = require('node:fs');
const JSDOM = require('jsdom');
const SEP_LINE = ',\n';
const FILES = [
    {
        path: 'projects/inugami-svg-assets/src/inugami_default_svg_assets.svg',
        iconSetName: 'INUGAMI_SVG_ASSETS_DEFAULT',
        targetFolder: 'projects/inugami-svg-assets/src/lib',
        targetFile: 'inugami-svg-assets.default.ts',
    }
];

const INKSCAPE_ATTRIBUTES = [
    'id',
    'inkscape:groupmode',
    'inkscape:insensitive',
    'inkscape:label',
    'inkscape:nodetypes',
    'inkscape:connector-curvature',
    'style',
    'sodipodi:nodetypes'
];

const INKSCAPE_ATTRIBUTES_CHILDREN = [
    'id',
    'inkscape:groupmode',
    'inkscape:insensitive',
    'inkscape:label',
    'inkscape:nodetypes',
    'inkscape:connector-curvature',
    'sodipodi:nodetypes'
];

// ============================================================================
// PARSING
// ============================================================================
function process(fileInfo) {
    FS.readFile(fileInfo.path, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }

        const iconSets = parseSvg(new JSDOM.JSDOM(data));

        if (iconSets) {
            const fileContent = renderSvg(iconSets, fileInfo);
            writeFile(
                `
${fileContent}
`, fileInfo);
        }
    });
}

function parseSvg(dom) {
    const result = [];
    const svgNode = dom.window.document.getElementsByTagName('svg')[0];

    for (child of svgNode.children) {
        const id = child.getAttribute('inkscape:label');
        const inkscapeId = child.getAttribute('id');

        if (!id || id.startsWith('_') || !inkscapeId.startsWith('layer')) {
            continue;
        }

        result.push({
            name: convertToCamelCase(id),
            assets: extractAssets(child),
        });
    }
    return result;
}

function extractAssets(iconSetNode) {
    const result = [];

    for (child of iconSetNode.children) {
        const assert = extractAsset(child);
        if (assert) {
            result.push(assert);
        }
    }

    return result;
}

function extractAsset(node) {
    const id = node.getAttribute('inkscape:label');
    if (!id) {
        return undefined;
    }
    const attributes = [];
    for(let attribute of node.attributes){
        if(attribute.name.startsWith('attr_')){
            attributes.push({
                name : attribute.name.split('attr_')[1],
                value : attribute.value
            })
        }
    }

    return {
        name: convertToCamelCase(id),
        types: extractTypes(node.children),
        attributes : attributes
    };
}

function extractTypes(nodes) {
    const result = [];
    if (!nodes) {
        result;
    }

    for (let node of nodes) {
        const assetType = extractType(node);
        if (!assetType) {
            continue;
        }
        result.push(assetType);
    }
    return result;
}

function extractType(node) {
    return {
        name: convertToCamelCase(node.getAttribute('inkscape:label')),
        states: node.children && node.children.length > 0 ? extractState(node.children[0]) : []
    };
}

function extractState(node) {
    const result = [];
    if (!node.children || node.children.length == 0) {
        return result;
    }
    for (let child of node.children) {
        result.push({
            name: convertToCamelCase(child.getAttribute('inkscape:label')),
            content: child
        })
    }

    return result;
}

// ============================================================================
// RENDERING
// ============================================================================
function renderSvg(iconSets, fileInfo) {
    const assetSets = renderAssetSets(iconSets);
    return `import { SvgAssetSet } from "./inugami-svg-asset.model";
    
export const ${fileInfo.iconSetName} : SvgAssetSet[] = [
${assetSets}
]
`
}


function renderAssetSets(iconSets) {
    const sets = [];

    for (let iconSet of iconSets) {
        sets.push(renderAssetSet(iconSet));
    }

    return sets.join(SEP_LINE);
}

function renderAssetSet(iconSet) {
    return `{
    name:'${iconSet.name}',
    assets: [
    ${renderAssets(iconSet.assets, iconSet.name)}
    ]
}`
}

function renderAssets(assets, iconSetName) {
    const result = [];

    for (let asset of assets) {
        result.push(renderAsset(asset, iconSetName));
    }

    return result.join(SEP_LINE);
}

function renderAsset(asset, iconSetName) {

    return `{
    name:'${asset.name}',
    types: [
        ${renderTypes(asset.types, iconSetName, asset.name)}
    ],
    attributes: [${renderAttributes(asset.attributes)}]
}
`;
}
function renderAttributes(attributes){
    if(!attributes || attributes.length==0){
        return '';
    }
    const result = [];
    for(let attribute of attributes){
        result.push(`{name:'${attribute.name}', value:'${attribute.value}'}`)
    }
    return result.join(',');
}

function renderTypes(types, iconSetName, assetName) {
    const result = [];
    for (let type of types) {
        result.push(renderType(type, iconSetName, assetName))
    }
    return result.join(SEP_LINE);
}

function renderType(type, iconSetName, assetName) {
    return `{
    name: '${type.name}',
    states : [
    ${renderStates(type.states, iconSetName, assetName, type.name)}
    ]
}`;
}

function renderStates(states, iconSetName, assetName, typeName) {
    const sets = [];
    for (let state of states) {
        sets.push(renderState(state, iconSetName, assetName, typeName));
    }
    return sets.join(SEP_LINE);
}

function renderState(state, iconSetName, assetName, typeName) {
    state.content.setAttribute('class',
        [
            'asset',
            'asset-set-' + convertToCamelCase(iconSetName),
            'asset-' + convertToCamelCase(assetName),
            'type-' + convertToCamelCase(typeName),
            'state-' + convertToCamelCase(state.name),
        ].join(' '));
    suppressInkscapeAttributes(state.content, 0);
    return `{
    name:'${state.name}',
    content: \`${state.content.outerHTML}\`
}`;
}


// ============================================================================
// TOOLS
// ============================================================================

function writeFile(fileContent, fileInfo) {
    if (!FS.existsSync(fileInfo.targetFolder)) {
        FS.mkdirSync(fileInfo.targetFolder);
    }

    const file = `${fileInfo.targetFolder}/${fileInfo.targetFile}`;
    console.log(`write file : ${file}`);
    FS.writeFile(file, fileContent, err => {
        if (err) {
            console.error(err);
        }
    });
}

function convertToCamelCase(id) {
    if (!id) {
        return '';
    }
    const result = [];
    const values = id.split('-');

    for (let i = 0; i < values.length; i++) {
        if (i == 0) {
            result.push(values[i].trim());
        } else {
            const data = values[i].trim();
            result.push(data.substring(0, 1).toUpperCase());
            result.push(data.substring(1));
        }
    }
    return result.join('');
}

function suppressInkscapeAttributes(node, level) {
    if (node) {
        for (attr of (level <= 1 ? INKSCAPE_ATTRIBUTES : INKSCAPE_ATTRIBUTES_CHILDREN)) {
            node.removeAttribute(attr);

            if (node.children) {
                for (childNode of node.children) {
                    suppressInkscapeAttributes(childNode, level + 1);
                }
            }
        }
    }
}


// ============================================================================
// MAIN
// ============================================================================
for (file of FILES) {
    process(file);
}