/**
 * WordPress dependencies
 */
import { useCallback, useEffect, useRef } from '@wordpress/element';
import { serialize, pasteHandler } from '@wordpress/blocks';
import { documentHasSelection, documentHasTextSelection } from '@wordpress/dom';
import { useDispatch, useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getPasteEventData } from '../../utils/get-paste-event-data';

function useFlashBlock() {
	const { toggleBlockHighlight } = useDispatch( 'core/block-editor' );
	const timeouts = useRef( [] );
	const flashBlock = useCallback(
		( clientId ) => {
			toggleBlockHighlight( clientId, true );
			const timeout = setTimeout( () => {
				toggleBlockHighlight( clientId, false );
			}, 1000 );
			timeouts.current.push( timeout );
		},
		[ toggleBlockHighlight ]
	);
	useEffect( () => {
		return () => {
			timeouts.current.forEach( ( timeout ) => {
				clearTimeout( timeout );
			} );
		};
	}, [] );
	return flashBlock;
}

function CopyHandler( { children } ) {
	const containerRef = useRef();

	const {
		getBlockName,
		getBlocksByClientId,
		getSelectedBlockClientIds,
		hasMultiSelection,
		getSettings,
	} = useSelect( ( select ) => select( 'core/block-editor' ), [] );
	const { getBlockType } = useSelect(
		( select ) => select( 'core/blocks' ),
		[]
	);

	const { removeBlocks, replaceBlocks } = useDispatch( 'core/block-editor' );
	const { createSuccessNotice } = useDispatch( 'core/notices' );

	const flashBlock = useFlashBlock();

	const {
		__experimentalCanUserUseUnfilteredHTML: canUserUseUnfilteredHTML,
	} = getSettings();

	const handler = ( event ) => {
		const selectedBlockClientIds = getSelectedBlockClientIds();

		if ( selectedBlockClientIds.length === 0 ) {
			return;
		}

		// Always handle multiple selected blocks.
		if ( ! hasMultiSelection() ) {
			// If copying, only consider actual text selection as selection.
			// Otherwise, any focus on an input field is considered.
			const hasSelection =
				event.type === 'copy' || event.type === 'cut'
					? documentHasTextSelection()
					: documentHasSelection();

			// Let native copy behaviour take over in input fields.
			if ( hasSelection ) {
				return;
			}
		}

		if ( ! containerRef.current.contains( event.target ) ) {
			return;
		}
		event.preventDefault();

		if ( event.type === 'copy' || event.type === 'cut' ) {
			let notice;
			if ( selectedBlockClientIds.length === 1 ) {
				const clientId = selectedBlockClientIds[ 0 ];
				const { title } = getBlockType( getBlockName( clientId ) );
				flashBlock( clientId );
				notice = sprintf(
					// Translators: Name of the block being copied, e.g. "Paragraph"
					__( 'Copied block "%s" to clipboard.' ),
					title
				);
			} else {
				notice = sprintf(
					// Translators: Number of blocks being copied
					__( 'Copied %d blocks to clipboard.' ),
					selectedBlockClientIds.length
				);
			}
			createSuccessNotice( notice, {
				type: 'snackbar',
			} );
			const blocks = getBlocksByClientId( selectedBlockClientIds );
			const serialized = serialize( blocks );

			event.clipboardData.setData( 'text/plain', serialized );
			event.clipboardData.setData( 'text/html', serialized );
		}

		if ( event.type === 'cut' ) {
			removeBlocks( selectedBlockClientIds );
		} else if ( event.type === 'paste' ) {
			const { plainText, html } = getPasteEventData( event );
			const blocks = pasteHandler( {
				HTML: html,
				plainText,
				mode: 'BLOCKS',
				canUserUseUnfilteredHTML,
			} );

			replaceBlocks(
				selectedBlockClientIds,
				blocks,
				blocks.length - 1,
				-1
			);
		}
	};

	return (
		<div
			ref={ containerRef }
			onCopy={ handler }
			onCut={ handler }
			onPaste={ handler }
		>
			{ children }
		</div>
	);
}

export default CopyHandler;
