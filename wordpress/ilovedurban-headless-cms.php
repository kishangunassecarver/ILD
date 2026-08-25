<?php
/**
 * Plugin Name:  I Love Durban Headless CMS
 * Description:  Serves the I Love Durban directory as JSON and triggers a Cloudflare rebuild when content is published.
 * Version:      1.3.0
 * Author:       I Love Durban
 * License:      GPL-2.0-or-later
 *
 * Exposes:  GET /wp-json/ilovedurban/v1/content
 * Consumed by the Next.js site at build time (scripts/fetch-wp-content.mjs).
 *
 * Only core WordPress is required — no ACF, no paid add-ons.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const ILD_NS       = 'ilovedurban/v1';
const ILD_HOOK_OPT = 'ild_deploy_hook_url';
const ILD_SETTINGS = 'ild_settings';
const ILD_MENU     = 'ild-content';

/**
 * Content types, and the fields each adds beyond the post title.
 *
 * Field types:
 *   'text'     — single line.
 *   'textarea' — single string, newlines preserved.
 *   'paras'    — textarea; blank lines split it into an array of paragraphs.
 *   'lines'    — textarea; one array entry per line.
 *   'pipe'     — textarea; one entry per line, columns split on "|".
 *   'select'   — one of 'options'.
 *   'bool'     — checkbox.
 *   'number'   — cast to a float in the JSON.
 *   'int'      — cast to an integer in the JSON.
 *
 * The post title becomes the field named in 'title_as', and the post slug
 * becomes 'slug'. A featured image, if set, becomes 'image'.
 */
function ild_schema(): array {
	return array(
		'ild_hub'      => array(
			'plural'   => 'Hubs',
			'key'      => 'hubs',
			'title_as' => 'title',
			'no_slug'  => true, // The hub's identity is the select below, not the post slug.
			'fields'   => array(
				'slug'       => array(
					'type'    => 'select',
					'label'   => 'Which hub is this? (cannot be added to — the routes are fixed)',
					'options' => array( 'eat-drink', 'stay', 'things-to-do', 'shop', 'services' ),
				),
				'intro'      => array( 'type' => 'textarea', 'label' => 'Intro paragraph' ),
				'filters'    => array( 'type' => 'lines', 'label' => 'Filter chips — one per line' ),
				'defaultCta' => array( 'type' => 'text', 'label' => 'Default button label (e.g. "Book a Table")' ),
			),
		),
		'ild_listing'  => array(
			'plural'   => 'Listings',
			'key'      => 'listings',
			'title_as' => 'name',
			'fields'   => array(
				'hub'       => array(
					'type'    => 'select',
					'label'   => 'Hub',
					'options' => array( 'eat-drink', 'stay', 'things-to-do', 'shop', 'services' ),
				),
				'category'  => array( 'type' => 'text', 'label' => 'Category — must match one of the hub\'s filter chips' ),
				'area'      => array( 'type' => 'text', 'label' => 'Suburb or area (e.g. "Umhlanga Rocks")' ),
				'rating'    => array( 'type' => 'number', 'label' => 'Rating out of 5 (e.g. 4.6)' ),
				'reviews'   => array( 'type' => 'int', 'label' => 'Number of reviews' ),
				'price'     => array( 'type' => 'text', 'label' => 'Price band ($ to $$$$, or "Free")' ),
				'blurb'     => array( 'type' => 'textarea', 'label' => 'One-line summary (shown on cards)' ),
				'body'      => array( 'type' => 'paras', 'label' => 'Full description — leave a blank line between paragraphs' ),
				'tags'      => array( 'type' => 'lines', 'label' => 'Tags — one per line' ),
				'cta'       => array( 'type' => 'text', 'label' => 'Button label (blank uses the hub default)' ),
				'featured'  => array( 'type' => 'bool', 'label' => 'Feature this listing' ),
				'address'   => array( 'type' => 'text', 'label' => 'Address' ),
				'phone'     => array( 'type' => 'text', 'label' => 'Phone' ),
				'website'   => array( 'type' => 'text', 'label' => 'Website (https://…)' ),
				'hours'     => array( 'type' => 'lines', 'label' => 'Opening hours — one line per row' ),
				'amenities' => array( 'type' => 'lines', 'label' => 'Good to know — one per line' ),
			),
		),
		'ild_event'    => array(
			'plural'   => 'Events',
			'key'      => 'events',
			'title_as' => 'title',
			'fields'   => array(
				'date'      => array( 'type' => 'text', 'label' => 'Date — YYYY-MM-DD (drives the date tile and ordering)' ),
				'dateLabel' => array( 'type' => 'text', 'label' => 'Date label (e.g. "24 – 26 September")' ),
				'venue'     => array( 'type' => 'text', 'label' => 'Venue' ),
				'area'      => array( 'type' => 'text', 'label' => 'Area' ),
				'category'  => array( 'type' => 'text', 'label' => 'Category (e.g. Music, Markets, Sport)' ),
				'blurb'     => array( 'type' => 'textarea', 'label' => 'One-line summary' ),
				'body'      => array( 'type' => 'paras', 'label' => 'Full description — blank line between paragraphs' ),
				'price'     => array( 'type' => 'text', 'label' => 'Price (e.g. "From R350", "Free entry")' ),
				'ticketUrl' => array( 'type' => 'text', 'label' => 'Ticket link' ),
				'featured'  => array( 'type' => 'bool', 'label' => 'Feature this event' ),
			),
		),
		'ild_deal'     => array(
			'plural'   => 'Deals',
			'key'      => 'deals',
			'title_as' => 'title',
			'fields'   => array(
				'business'   => array( 'type' => 'text', 'label' => 'Business name' ),
				'badge'      => array( 'type' => 'text', 'label' => 'Flash on the card (e.g. "20% OFF")' ),
				'validUntil' => array( 'type' => 'text', 'label' => 'Valid until — YYYY-MM-DD' ),
				'category'   => array( 'type' => 'text', 'label' => 'Category (e.g. "Eat & Drink")' ),
				'area'       => array( 'type' => 'text', 'label' => 'Area' ),
				'blurb'      => array( 'type' => 'textarea', 'label' => 'What the offer is' ),
				'terms'      => array( 'type' => 'lines', 'label' => 'Terms — one per line' ),
			),
		),
		'ild_sponsor'  => array(
			'plural'   => 'Sponsors',
			'key'      => 'sponsors',
			'title_as' => 'name',
			'no_slug'  => true,
			'fields'   => array(
				'placement' => array(
					'type'    => 'select',
					'label'   => 'Placement',
					'options' => array( 'title', 'sidebar', 'leaderboard' ),
				),
				'eyebrow'   => array( 'type' => 'text', 'label' => 'Small print above the headline' ),
				'headline'  => array( 'type' => 'text', 'label' => 'Headline' ),
				'subhead'   => array( 'type' => 'text', 'label' => 'Sub-headline' ),
				'body'      => array( 'type' => 'textarea', 'label' => 'Body copy (sidebar only)' ),
				'cta'       => array( 'type' => 'text', 'label' => 'Button label' ),
				'href'      => array( 'type' => 'text', 'label' => 'Link' ),
				'art'       => array( 'type' => 'text', 'label' => 'Gradient classes (ask the developers — e.g. "from-[#3B1E7A] via-[#5B2AA8] to-[#8E2DE2]")' ),
			),
		),
		'ild_plan'     => array(
			'plural'   => 'Business Plans',
			'key'      => 'businessPlans',
			'title_as' => 'name',
			'no_slug'  => true,
			'fields'   => array(
				'price'    => array( 'type' => 'text', 'label' => 'Price (e.g. "R690", "From R2 450")' ),
				'period'   => array( 'type' => 'text', 'label' => 'Period (e.g. "per month")' ),
				'summary'  => array( 'type' => 'textarea', 'label' => 'One-line summary' ),
				'includes' => array( 'type' => 'lines', 'label' => 'What is included — one per line' ),
				'cta'      => array( 'type' => 'text', 'label' => 'Button label' ),
				'featured' => array( 'type' => 'bool', 'label' => 'Mark as "Most popular"' ),
			),
		),
	);
}

/**
 * Single-value settings, edited on one screen rather than as posts.
 *
 * Keys are dotted: "site.tagline" becomes { site: { tagline: … } } in the JSON.
 */
function ild_settings_schema(): array {
	return array(
		'Site copy'     => array(
			'site.tagline'           => array( 'type' => 'text', 'label' => 'Tagline' ),
			'site.description'       => array( 'type' => 'textarea', 'label' => 'Site description (also used for SEO)' ),
			'site.searchPlaceholder' => array( 'type' => 'text', 'label' => 'Search box placeholder' ),
			'site.popularSearches'   => array( 'type' => 'lines', 'label' => 'Popular search chips — one per line' ),
		),
		'App promo'     => array(
			'appPromo.title'     => array( 'type' => 'text', 'label' => 'Heading' ),
			'appPromo.points'    => array( 'type' => 'lines', 'label' => 'Bullet points — one per line' ),
			'appPromo.cta'       => array( 'type' => 'text', 'label' => 'Button label' ),
			'appPromo.ctaHref'   => array( 'type' => 'text', 'label' => 'Button link' ),
			'appPromo.storeNote' => array( 'type' => 'text', 'label' => 'Text above the store badges' ),
		),
		'Newsletter'    => array(
			'newsletter.title' => array( 'type' => 'text', 'label' => 'Heading' ),
			'newsletter.body'  => array( 'type' => 'text', 'label' => 'Sub-heading' ),
			'newsletter.cta'   => array( 'type' => 'text', 'label' => 'Button label' ),
		),
		'Numbers'       => array(
			'stats' => array(
				'type'  => 'pipe',
				'label' => 'Stats — one per line: 4 200+|Local businesses listed',
				'cols'  => array( 'value', 'label' ),
			),
		),
	);
}

/* -------------------------------------------------------------------------
 * Post types
 * ---------------------------------------------------------------------- */

add_action( 'init', 'ild_register_types' );
function ild_register_types(): void {
	foreach ( ild_schema() as $type => $config ) {
		register_post_type(
			$type,
			array(
				'labels'          => array(
					'name'          => $config['plural'],
					'singular_name' => rtrim( $config['plural'], 's' ),
					'add_new_item'  => 'Add ' . rtrim( $config['plural'], 's' ),
					'edit_item'     => 'Edit ' . rtrim( $config['plural'], 's' ),
				),
				'public'          => false,
				'show_ui'         => true,
				'show_in_menu'    => ILD_MENU,
				'supports'        => array( 'title', 'thumbnail', 'page-attributes' ),
				'hierarchical'    => false,
				'capability_type' => 'post',
			)
		);
	}
}

/* -------------------------------------------------------------------------
 * Admin menu
 * ---------------------------------------------------------------------- */

add_action( 'admin_menu', 'ild_admin_menu' );
function ild_admin_menu(): void {
	add_menu_page(
		'I Love Durban Content',
		// Spelled out rather than abbreviated: this sidebar may sit next to
		// another headless-CMS plugin, and "ILD" is not self-explanatory.
		'I Love Durban',
		'edit_posts',
		ILD_MENU,
		'ild_settings_page',
		'dashicons-heart',
		3
	);

	add_submenu_page( ILD_MENU, 'Site Copy & Deploy', 'Site Copy & Deploy', 'edit_posts', ILD_MENU, 'ild_settings_page' );
}

function ild_settings_page(): void {
	if ( ! current_user_can( 'edit_posts' ) ) {
		wp_die( 'You do not have permission to edit this content.' );
	}

	$saved = false;

	if ( isset( $_POST['ild_save'] ) && check_admin_referer( 'ild_save_settings' ) ) {
		$settings = get_option( ILD_SETTINGS, array() );

		foreach ( ild_settings_schema() as $fields ) {
			foreach ( $fields as $key => $field ) {
				$posted           = isset( $_POST[ 'ild_' . $key ] ) ? wp_unslash( $_POST[ 'ild_' . $key ] ) : '';
				$settings[ $key ] = sanitize_textarea_field( $posted );
			}
		}

		update_option( ILD_SETTINGS, $settings );

		if ( isset( $_POST[ ILD_HOOK_OPT ] ) ) {
			update_option( ILD_HOOK_OPT, esc_url_raw( wp_unslash( $_POST[ ILD_HOOK_OPT ] ) ) );
		}

		ild_trigger_deploy( 'settings saved' );
		$saved = true;
	}

	$settings = get_option( ILD_SETTINGS, array() );

	echo '<div class="wrap"><h1>Site Copy &amp; Deploy</h1>';

	if ( $saved ) {
		echo '<div class="notice notice-success is-dismissible"><p>Saved. The site is rebuilding — allow two to four minutes.</p></div>';
	}

	echo '<p>Anything you leave blank keeps the wording already built into the site. Lists are one item per line.</p>';
	echo '<form method="post">';
	wp_nonce_field( 'ild_save_settings' );

	foreach ( ild_settings_schema() as $group => $fields ) {
		echo '<h2>' . esc_html( $group ) . '</h2><table class="form-table"><tbody>';

		foreach ( $fields as $key => $field ) {
			$value = $settings[ $key ] ?? '';
			$name  = 'ild_' . $key;

			echo '<tr><th scope="row"><label for="' . esc_attr( $name ) . '">' . esc_html( $field['label'] ) . '</label></th><td>';

			if ( 'text' === $field['type'] ) {
				echo '<input type="text" class="large-text" id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" />';
			} else {
				echo '<textarea class="large-text code" rows="5" id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '">' . esc_textarea( $value ) . '</textarea>';
			}

			echo '</td></tr>';
		}

		echo '</tbody></table>';
	}

	$hook = get_option( ILD_HOOK_OPT, '' );
	echo '<h2>Deployment</h2><table class="form-table"><tbody><tr><th scope="row"><label for="' . esc_attr( ILD_HOOK_OPT ) . '">Cloudflare deploy hook URL</label></th><td>';
	echo '<input type="url" class="large-text code" id="' . esc_attr( ILD_HOOK_OPT ) . '" name="' . esc_attr( ILD_HOOK_OPT ) . '" value="' . esc_attr( $hook ) . '" placeholder="https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/..." />';
	echo '<p class="description">Publishing any content POSTs to this URL, which rebuilds the site. Leave blank to disable automatic rebuilds. Treat it as a secret.</p>';
	echo '</td></tr></tbody></table>';

	submit_button( 'Save and rebuild site', 'primary', 'ild_save' );
	echo '</form></div>';
}

/* -------------------------------------------------------------------------
 * Meta boxes
 * ---------------------------------------------------------------------- */

add_action( 'add_meta_boxes', 'ild_add_meta_boxes' );
function ild_add_meta_boxes(): void {
	foreach ( ild_schema() as $type => $config ) {
		add_meta_box(
			$type . '_fields',
			rtrim( $config['plural'], 's' ) . ' details',
			'ild_render_meta_box',
			$type,
			'normal',
			'high'
		);
	}
}

function ild_render_meta_box( WP_Post $post ): void {
	$schema = ild_schema();
	$config = $schema[ $post->post_type ] ?? null;
	if ( ! $config ) {
		return;
	}

	wp_nonce_field( 'ild_save_meta_' . $post->ID, 'ild_meta_nonce' );

	echo '<table class="form-table"><tbody>';

	foreach ( $config['fields'] as $key => $field ) {
		$value = get_post_meta( $post->ID, '_ild_' . $key, true );
		$name  = 'ild_' . $key;

		echo '<tr><th scope="row"><label for="' . esc_attr( $name ) . '">' . esc_html( $field['label'] ) . '</label></th><td>';

		switch ( $field['type'] ) {
			case 'bool':
				echo '<input type="checkbox" id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '" value="1" ' . checked( $value, '1', false ) . ' />';
				break;

			case 'select':
				echo '<select id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '"><option value="">—</option>';
				foreach ( $field['options'] as $option ) {
					echo '<option value="' . esc_attr( $option ) . '" ' . selected( $value, $option, false ) . '>' . esc_html( $option ) . '</option>';
				}
				echo '</select>';
				break;

			case 'textarea':
			case 'paras':
			case 'lines':
			case 'pipe':
				echo '<textarea class="large-text code" rows="5" id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '">' . esc_textarea( $value ) . '</textarea>';
				break;

			default:
				echo '<input type="text" class="large-text" id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" />';
		}

		echo '</td></tr>';
	}

	echo '</tbody></table>';
	echo '<p class="description">Ordering is controlled by the <strong>Order</strong> field under Page Attributes — lowest first.</p>';
}

add_action( 'save_post', 'ild_save_meta', 10, 2 );
function ild_save_meta( int $post_id, WP_Post $post ): void {
	$schema = ild_schema();
	$config = $schema[ $post->post_type ] ?? null;

	if ( ! $config || wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
		return;
	}

	if ( ! isset( $_POST['ild_meta_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['ild_meta_nonce'] ), 'ild_save_meta_' . $post_id ) ) {
		return;
	}

	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	foreach ( $config['fields'] as $key => $field ) {
		$name = 'ild_' . $key;

		if ( 'bool' === $field['type'] ) {
			update_post_meta( $post_id, '_ild_' . $key, isset( $_POST[ $name ] ) ? '1' : '' );
			continue;
		}

		$raw = isset( $_POST[ $name ] ) ? wp_unslash( $_POST[ $name ] ) : '';
		update_post_meta( $post_id, '_ild_' . $key, sanitize_textarea_field( $raw ) );
	}
}

/* -------------------------------------------------------------------------
 * REST endpoint
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', 'ild_register_rest' );
function ild_register_rest(): void {
	register_rest_route(
		ILD_NS,
		'/content',
		array(
			'methods'             => 'GET',
			'callback'            => 'ild_rest_content',
			'permission_callback' => '__return_true', // public, read-only directory content
		)
	);
}

function ild_posts( string $type ): array {
	return get_posts(
		array(
			'post_type'        => $type,
			'post_status'      => 'publish',
			'numberposts'      => 500,
			'orderby'          => array( 'menu_order' => 'ASC', 'title' => 'ASC' ),
			'suppress_filters' => false,
		)
	);
}

/**
 * Decode one string for the JSON payload.
 *
 * WordPress stores and returns copy with HTML entities encoded — "&amp;",
 * "&#8217;", "&hellip;". The site renders through React, which escapes strings
 * on output, so an un-decoded "&amp;" reaches the page as the literal text
 * "&amp;" rather than "&". Decode once, here, and the JSON carries real
 * characters. Decoding is idempotent for text that has no entities in it.
 */
function ild_text( $value ): string {
	$value = html_entity_decode( (string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

	// Editors paste non-breaking spaces without meaning to, and they break
	// line wrapping in a way that is very hard to spot in the admin.
	return trim( str_replace( "\xc2\xa0", ' ', $value ) );
}

/** Turn one stored meta value into whatever the JSON contract expects. */
function ild_cast( string $raw, array $field ) {
	$raw = trim( $raw );

	switch ( $field['type'] ) {
		case 'bool':
			return '1' === $raw;

		case 'number':
			return '' === $raw ? null : (float) $raw;

		case 'int':
			return '' === $raw ? null : (int) $raw;

		case 'lines':
			if ( '' === $raw ) {
				return array();
			}
			return array_values( array_filter( array_map( 'ild_text', preg_split( '/\r\n|\r|\n/', $raw ) ), 'strlen' ) );

		case 'paras':
			if ( '' === $raw ) {
				return array();
			}
			return array_values( array_filter( array_map( 'ild_text', preg_split( '/(\r\n|\r|\n){2,}/', $raw ) ), 'strlen' ) );

		case 'pipe':
			if ( '' === $raw ) {
				return array();
			}
			$rows = array();
			foreach ( preg_split( '/\r\n|\r|\n/', $raw ) as $line ) {
				$line = trim( $line );
				if ( '' === $line ) {
					continue;
				}
				$parts = array_map( 'ild_text', explode( '|', $line ) );
				$row   = array();
				foreach ( $field['cols'] as $i => $col ) {
					$row[ $col ] = $parts[ $i ] ?? '';
				}
				$rows[] = $row;
			}
			return $rows;

		default:
			return ild_text( $raw );
	}
}

/** One post → one JSON object, with empty fields omitted entirely. */
function ild_entry( WP_Post $post, array $config ): array {
	$entry = array();

	if ( empty( $config['no_slug'] ) ) {
		$entry['slug'] = $post->post_name;
	}

	$entry[ $config['title_as'] ] = ild_text( get_the_title( $post ) );

	foreach ( $config['fields'] as $key => $field ) {
		$value = ild_cast( (string) get_post_meta( $post->ID, '_ild_' . $key, true ), $field );

		// Omit blanks so the site's defaults survive a partially filled entry.
		if ( null === $value || '' === $value || ( is_array( $value ) && ! $value ) ) {
			continue;
		}
		if ( false === $value && 'bool' === $field['type'] ) {
			continue;
		}

		$entry[ $key ] = $value;
	}

	$image = get_the_post_thumbnail_url( $post, 'full' );
	if ( $image ) {
		$entry['image'] = $image;
	}

	return $entry;
}

/** Blog posts come from WordPress's native post type, not a custom one. */
function ild_blog_posts(): array {
	$out = array();

	foreach ( ild_posts( 'post' ) as $post ) {
		$content = wp_strip_all_tags( str_replace( array( '</p>', '<br />', '<br>' ), "\n\n", apply_filters( 'the_content', $post->post_content ) ) );
		$body    = array_values( array_filter( array_map( 'ild_text', preg_split( '/(\r\n|\r|\n){2,}/', $content ) ), 'strlen' ) );

		if ( ! $body ) {
			continue;
		}

		$terms    = get_the_terms( $post, 'category' );
		$category = ( $terms && ! is_wp_error( $terms ) ) ? ild_text( $terms[0]->name ) : 'Durban';

		$entry = array(
			'slug'     => $post->post_name,
			'title'    => ild_text( get_the_title( $post ) ),
			'date'     => get_the_date( 'Y-m-d', $post ),
			'author'   => ild_text( get_the_author_meta( 'display_name', (int) $post->post_author ) ),
			'category' => $category,
			'excerpt'  => ild_text( wp_strip_all_tags( get_the_excerpt( $post ) ) ),
			'body'     => $body,
		);

		$image = get_the_post_thumbnail_url( $post, 'full' );
		if ( $image ) {
			$entry['image'] = $image;
		}

		$out[] = $entry;
	}

	return $out;
}

/** Expand the dotted settings keys into the nested shape lib/cms.ts expects. */
function ild_settings_payload(): array {
	$settings = get_option( ILD_SETTINGS, array() );
	$payload  = array();

	foreach ( ild_settings_schema() as $fields ) {
		foreach ( $fields as $key => $field ) {
			$value = ild_cast( (string) ( $settings[ $key ] ?? '' ), $field );

			if ( null === $value || '' === $value || ( is_array( $value ) && ! $value ) ) {
				continue;
			}

			if ( str_contains( $key, '.' ) ) {
				list( $group, $leaf )      = explode( '.', $key, 2 );
				$payload[ $group ][ $leaf ] = $value;
			} else {
				$payload[ $key ] = $value;
			}
		}
	}

	return $payload;
}

function ild_rest_content(): WP_REST_Response {
	$payload = ild_settings_payload();

	foreach ( ild_schema() as $type => $config ) {
		$entries = array();
		foreach ( ild_posts( $type ) as $post ) {
			$entries[] = ild_entry( $post, $config );
		}
		if ( $entries ) {
			$payload[ $config['key'] ] = $entries;
		}
	}

	$posts = ild_blog_posts();
	if ( $posts ) {
		$payload['posts'] = $posts;
	}

	/*
	 * Cast the top level to an object.
	 *
	 * PHP cannot tell an empty list from an empty map, so an empty $payload
	 * would encode as "[]" rather than "{}" — and the site's fetch script
	 * rejects arrays as a malformed response. Casting pins the container to an
	 * object. Only the top level is cast, so the collections nested inside it
	 * stay as JSON arrays.
	 */
	$response = new WP_REST_Response( (object) $payload );
	// The build fetches this once; a short cache absorbs retries without going stale.
	$response->header( 'Cache-Control', 'public, max-age=60' );

	return $response;
}

/* -------------------------------------------------------------------------
 * Deploy hook
 * ---------------------------------------------------------------------- */

add_action( 'transition_post_status', 'ild_on_transition', 10, 3 );
function ild_on_transition( string $new_status, string $old_status, WP_Post $post ): void {
	$watched = array_keys( ild_schema() );
	$watched[] = 'post';

	if ( ! in_array( $post->post_type, $watched, true ) ) {
		return;
	}

	// Publishing, unpublishing and edits to live content all change the site.
	if ( 'publish' !== $new_status && 'publish' !== $old_status ) {
		return;
	}

	ild_trigger_deploy( $post->post_type . ' ' . $new_status );
}

add_action( 'before_delete_post', 'ild_on_delete', 10, 2 );
function ild_on_delete( int $post_id, WP_Post $post ): void {
	if ( in_array( $post->post_type, array_keys( ild_schema() ), true ) && 'publish' === $post->post_status ) {
		ild_trigger_deploy( $post->post_type . ' deleted' );
	}
}

/**
 * POST the Cloudflare deploy hook, at most once a minute.
 *
 * A burst of edits should produce one build, not a dozen queued ones.
 */
function ild_trigger_deploy( string $reason ): void {
	$url = get_option( ILD_HOOK_OPT, '' );
	if ( ! $url ) {
		return;
	}

	if ( get_transient( 'ild_deploy_throttle' ) ) {
		return;
	}
	set_transient( 'ild_deploy_throttle', 1, MINUTE_IN_SECONDS );

	$res = wp_remote_post(
		$url,
		array(
			'timeout'  => 15,
			'blocking' => false,
			'body'     => '',
		)
	);

	if ( is_wp_error( $res ) ) {
		error_log( '[ilovedurban] deploy hook failed (' . $reason . '): ' . $res->get_error_message() );
	}
}
