'use strict';

const fs = require('fs');
const { randomUUID } = require('crypto');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const logger = require('../utils/logger');
const { validateFpsValue } = require('../utils/validators');

/**
 * Reads Roblox XML configuration and returns raw content and parsed metrics.
 */
function readConfigFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Roblox configuration file not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const validation = XMLValidator.validate(raw);
  if (validation !== true) {
    const errMsg = validation.err ? `${validation.err.msg} at line ${validation.err.line}` : 'Malformed XML';
    logger.error(`Roblox settings file is corrupted: ${errMsg}`);
    throw new Error(`Corrupted XML file: ${errMsg}`);
  }

  return raw;
}

/**
 * Extracts current FramerateCap integer from XML string.
 * @param {string} xmlContent
 * @returns {number|null}
 */
function locateCap(xml) {
  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, captureMetaData: true, processEntities: false });
  const tree = parser.parse(xml);
  const root = tree.find(node => node.roblox);
  const items = (root?.roblox || []).filter(node => node.Item && node[':@']?.['@_class'] === 'UserGameSettings');
  const properties = items.flatMap(node => node.Item).filter(node => node.Properties);
  if (properties.length !== 1) throw new Error('Expected one UserGameSettings Properties block.');
  const props = properties[0];
  const meta = XMLParser.getMetaDataSymbol();
  const caps = props.Properties.filter(node => node[':@']?.['@_name'] === 'FramerateCap');
  if (caps.length > 1) throw new Error('Multiple FramerateCap properties found.');
  if (!caps.length) {
    const pos = props[meta].startIndex;
    const open = xml.slice(pos).match(/^<Properties\s*>/);
    if (!open) throw new Error('Unsupported Properties element.');
    return { value: null, start: pos + open[0].length };
  }
  const { startIndex, endIndex } = caps[0][meta];
  const match = xml.slice(startIndex, endIndex).match(/^(<int\b[^>]*>\s*)(\d+)\s*<\/int\s*>$/);
  if (!match) throw new Error('FramerateCap is not an integer property.');
  return { value: Number(match[2]), start: startIndex + match[1].length, length: match[2].length };
}

function extractFpsFromXml(xmlContent) {
  return locateCap(xmlContent).value;
}

/**
 * Extracts key settings from the XML for display.
 */
function extractSettingsSummary(xmlContent) {
  const fps = extractFpsFromXml(xmlContent);

  const gfxModeMatch = xmlContent.match(/<token\s+name=["']GraphicsOptimizationMode["']>(\d+)<\/token>/i);
  const gfxLevelMatch = xmlContent.match(/<int\s+name=["']GraphicsQualityLevel["']>(\d+)<\/int>/i);
  const fullscreenMatch = xmlContent.match(/<bool\s+name=["']Fullscreen["']>(true|false)<\/bool>/i);
  const perfStatsMatch = xmlContent.match(/<bool\s+name=["']PerformanceStatsVisible["']>(true|false)<\/bool>/i);

  return {
    framerateCap: fps !== null ? fps : 'Not Found',
    graphicsOptimizationMode: gfxModeMatch ? gfxModeMatch[1] : null,
    graphicsQualityLevel: gfxLevelMatch ? parseInt(gfxLevelMatch[1], 10) : null,
    fullscreen: fullscreenMatch ? fullscreenMatch[1] === 'true' : null,
    performanceStatsVisible: perfStatsMatch ? perfStatsMatch[1] === 'true' : null,
  };
}

/**
 * Updates the FramerateCap value safely using atomic write and exact node replacement.
 * Preserves 100% of all other XML tags, indentation, comments, and schemas.
 *
 * @param {string} filePath
 * @param {number} targetFps
 * @returns {{success: boolean, previousFps: number, newFps: number, filePath: string}}
 */
function updateFpsInXml(filePath, targetFps, expectedXml) {
  const fpsValidation = validateFpsValue(targetFps);
  if (!fpsValidation.valid) {
    throw new Error(`Invalid target FPS: ${fpsValidation.error}`);
  }

  const rawXml = readConfigFile(filePath);
  if (expectedXml !== undefined && rawXml !== expectedXml) {
    throw new Error('Configuration changed after backup. Please retry.');
  }
  const cap = locateCap(rawXml);
  const currentFps = cap.value;
  const newline = rawXml.includes('\r\n') ? '\r\n' : '\n';
  const replacement = currentFps === null ? `${newline}\t\t\t<int name="FramerateCap">${targetFps}</int>` : String(targetFps);
  const newXml = rawXml.slice(0, cap.start) + replacement + rawXml.slice(cap.start + (cap.length || 0));

  // Validate the resulting XML before touching the filesystem
  const postValidation = XMLValidator.validate(newXml);
  if (postValidation !== true) {
    throw new Error('Post-modification XML validation failed. Aborting write to prevent corruption.');
  }

  // Atomic file write: write to .tmp file first, then replace original
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tempPath, newXml, { encoding: 'utf8', flag: 'wx' });

    // Verify temp file can be parsed
    const tempCheck = fs.readFileSync(tempPath, 'utf8');
    if (extractFpsFromXml(tempCheck) !== targetFps) {
      throw new Error('Verification check on temporary file failed.');
    }

    // Atomic replace
    if (fs.readFileSync(filePath, 'utf8') !== rawXml) {
      throw new Error('Configuration changed during the update. Please retry.');
    }
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    throw new Error(`Atomic write failed: ${err.message}`);
  }

  // Double check the live file
  const verifiedContent = fs.readFileSync(filePath, 'utf8');
  const verifiedFps = extractFpsFromXml(verifiedContent);

  if (verifiedFps !== targetFps) {
    throw new Error(`Verification failed: Expected ${targetFps} FPS, but read back ${verifiedFps} FPS`);
  }

  logger.info(`Successfully updated FPS from ${currentFps} to ${targetFps} in ${filePath}`);

  return {
    success: true,
    previousFps: currentFps,
    newFps: verifiedFps,
    filePath,
  };
}

module.exports = {
  readConfigFile,
  extractFpsFromXml,
  extractSettingsSummary,
  updateFpsInXml,
};
