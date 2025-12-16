import { datasetMeta, datasetParser } from '../catalog/courseCatalog';
import { resolveTermId } from '../../../config/term';

export function getDatasetSig(termId = resolveTermId()): string {
	// Contract: stable string combining term snapshot hash + meta revision/checksum + parserVersion.
	// Note: current dataset parser emits meta.revision/checksum as raw snapshot hash.
	const revision = datasetMeta.revision ?? '';
	const checksum = datasetMeta.checksum ?? '';
	const parserVersion = datasetParser.version ?? '';
	return [termId, revision, checksum, parserVersion].join('|');
}
