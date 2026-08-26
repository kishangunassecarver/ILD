<?php
/**
 * Plugin Name:  I Love Durban Headless CMS
 * Description:  Serves the I Love Durban directory as JSON and triggers a Cloudflare rebuild when content is published.
 * Version:      2.3.0
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
				'googleRating'  => array( 'type' => 'number', 'label' => 'Google rating out of 5 (e.g. 4.6) — shown as an attributed "Google rating" block' ),
				'googleReviews' => array( 'type' => 'int', 'label' => 'Number of Google reviews' ),
				'googleUrl'     => array( 'type' => 'text', 'label' => 'Google Maps link for this business (the "See reviews on Google" button)' ),
				'imageUrl'    => array( 'type' => 'text', 'label' => 'Image URL — an alternative to setting a Featured Image, for photos hosted elsewhere. The Featured Image wins if both are set.' ),
				'imageCredit' => array( 'type' => 'text', 'label' => 'Photo credit — required for anything not shot by us or supplied by the business. e.g. "Photo: J. Doe / CC BY-SA 4.0"' ),
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
				'logo'      => array( 'type' => 'text', 'label' => 'Logo URL — upload to the Media Library and paste the file URL here. Transparent PNG or SVG; it sits on the panel background. Leave blank to set the partner name in type instead.' ),
				'art'       => array( 'type' => 'text', 'label' => 'Gradient classes (ask the developers — e.g. "from-[#3B1E7A] via-[#5B2AA8] to-[#8E2DE2]"). Used on its own, or underneath a background image.' ),
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
			'site.strapline'         => array( 'type' => 'text', 'label' => 'Strapline — the small line under the logo. Keep it short; it is set in tracked-out capitals.' ),
			'site.tagline'           => array( 'type' => 'text', 'label' => 'Browser tab tagline — shown in the browser tab and on shared links, not on the page itself.' ),
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
		'Bottom navigation bar' => array(
			'bottomNav.visibility' => array(
				'type'    => 'select',
				'label'   => 'Show the floating bottom bar? (phones and tablets only — desktop uses the main menu)',
				'options' => array( 'show', 'hide' ),
			),
			'bottomNav.items'      => array(
				'type'  => 'pipe',
				'label' => 'Bar items — one per line: Label|/link|icon. Icons: home, compass, search, tag, calendar, heart, map-pin, sparkles, award, utensils, bed, ticket, shopping-bag, wrench, megaphone, briefcase, store. Five fits comfortably; six starts to crowd.',
				'cols'  => array( 'label', 'href', 'icon' ),
			),
		),
	);
}

/* -------------------------------------------------------------------------
 * Post types
 * ---------------------------------------------------------------------- */

/* -------------------------------------------------------------------------
 * Menus — managed in Appearance → Menus
 * ---------------------------------------------------------------------- */

add_action( 'after_setup_theme', 'ild_register_menus' );
function ild_register_menus(): void {
	register_nav_menus(
		array(
			'ild_primary' => 'I Love Durban — main menu (top level → column heading → links)',
			'ild_footer'  => 'I Love Durban — footer (top level → column heading, children → links)',
		)
	);
}

/**
 * Build a nested tree from a flat WordPress menu.
 *
 * wp_get_nav_menu_items() returns a flat list with menu_item_parent pointers.
 * Depth carries meaning on this site: for the main menu, level one is a nav
 * item, level two is a column heading in its dropdown, and level three are the
 * links under that heading.
 */
function ild_menu_tree( string $location ): array {
	$locations = get_nav_menu_locations();
	if ( empty( $locations[ $location ] ) ) {
		return array();
	}

	$items = wp_get_nav_menu_items( $locations[ $location ] );
	if ( ! $items ) {
		return array();
	}

	$by_parent = array();
	foreach ( $items as $item ) {
		$by_parent[ (int) $item->menu_item_parent ][] = $item;
	}

	$build = function ( int $parent ) use ( &$build, $by_parent ): array {
		$out = array();

		foreach ( $by_parent[ $parent ] ?? array() as $item ) {
			$node = array(
				'label'    => ild_text( $item->title ),
				// Site-relative where possible, so the JSON does not hard-code
				// the CMS hostname into every link.
				'href'     => ild_relative_url( $item->url ),
				'children' => $build( (int) $item->ID ),
			);

			if ( ! $node['children'] ) {
				unset( $node['children'] );
			}

			$out[] = $node;
		}

		return $out;
	};

	return $build( 0 );
}

/** Strip the site's own origin so links stay relative to the front end. */
function ild_relative_url( string $url ): string {
	$home = untrailingslashit( home_url() );

	if ( 0 === strpos( $url, $home ) ) {
		$path = substr( $url, strlen( $home ) );
		return '' === $path ? '/' : $path;
	}

	return $url;
}

/** Main menu → the NavItem[] shape the site's header expects. */
function ild_primary_nav(): array {
	$out = array();

	foreach ( ild_menu_tree( 'ild_primary' ) as $top ) {
		$entry   = array( 'label' => $top['label'], 'href' => $top['href'] );
		$columns = array();
		$loose   = array();

		foreach ( $top['children'] ?? array() as $second ) {
			if ( ! empty( $second['children'] ) ) {
				$columns[] = array(
					'heading' => $second['label'],
					'links'   => array_map(
						fn( $l ) => array( 'label' => $l['label'], 'href' => $l['href'] ),
						$second['children']
					),
				);
			} else {
				// A second-level item with no children of its own is a plain
				// link; collect them into one unnamed column.
				$loose[] = array( 'label' => $second['label'], 'href' => $second['href'] );
			}
		}

		if ( $loose ) {
			$columns[] = array( 'heading' => 'Explore', 'links' => $loose );
		}

		if ( $columns ) {
			$entry['columns'] = $columns;
		}

		$out[] = $entry;
	}

	return $out;
}

/** Footer menu → FooterColumn[]: top level are headings, children are links. */
function ild_footer_nav(): array {
	$out = array();

	foreach ( ild_menu_tree( 'ild_footer' ) as $column ) {
		if ( empty( $column['children'] ) ) {
			continue;
		}

		$out[] = array(
			'heading' => $column['label'],
			'links'   => array_map(
				fn( $l ) => array( 'label' => $l['label'], 'href' => $l['href'] ),
				$column['children']
			),
		);
	}

	return $out;
}

/* -------------------------------------------------------------------------
 * Pages — authored in the ordinary Pages screen
 * ---------------------------------------------------------------------- */

/**
 * Top-level paths that belong to the site's own routes.
 *
 * A WordPress page whose path starts with one of these is skipped: the built-in
 * route would win anyway, and generating both would be a silent conflict that
 * only shows up as a page mysteriously not updating.
 */
function ild_reserved_paths(): array {
	return array(
		'eat-drink', 'stay', 'things-to-do', 'shop', 'services',
		'events', 'deals', 'blog', 'discover', 'search', 'saved',
		'join', 'rewards', 'list-your-business', 'about', 'contact',
		'help', 'terms', 'privacy', 'sitemap.xml', 'robots.txt',
	);
}

/**
 * Sections whose children are generated from a collection, so nothing may live
 * beneath them. Everywhere else only the exact path is taken, which is why a
 * child page such as about/our-team is fine.
 */
function ild_reserved_namespaces(): array {
	return array( 'eat-drink', 'stay', 'things-to-do', 'shop', 'services', 'events', 'deals', 'blog' );
}

function ild_path_collides( string $path ): bool {
	if ( '' === $path || in_array( $path, ild_reserved_paths(), true ) ) {
		return true;
	}

	foreach ( ild_reserved_namespaces() as $namespace ) {
		if ( 0 === strpos( $path, $namespace . '/' ) ) {
			return true;
		}
	}

	return false;
}

function ild_pages(): array {
	$out = array();

	$pages = get_posts(
		array(
			'post_type'        => 'page',
			'post_status'      => 'publish',
			'numberposts'      => 200,
			'orderby'          => array( 'menu_order' => 'ASC', 'title' => 'ASC' ),
			'suppress_filters' => false,
		)
	);

	foreach ( $pages as $page ) {
		$path = trim( (string) get_page_uri( $page ), '/' );

		if ( ild_path_collides( $path ) ) {
			continue;
		}

		$html = apply_filters( 'the_content', $page->post_content );
		if ( '' === trim( wp_strip_all_tags( $html ) ) ) {
			continue;
		}

		$entry = array(
			'path'    => $path,
			'title'   => ild_text( get_the_title( $page ) ),
			'html'    => $html,
			'excerpt' => ild_text( wp_strip_all_tags( get_the_excerpt( $page ) ) ),
		);

		$image = get_the_post_thumbnail_url( $page, 'full' );
		if ( $image ) {
			$entry['image'] = $image;
		}

		$out[] = $entry;
	}

	return $out;
}

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

	add_submenu_page(
		ILD_MENU,
		'Starter Content',
		'Starter Content',
		'manage_options',
		'ild-starter',
		'ild_starter_page'
	);
}

/* -------------------------------------------------------------------------
 * Starter content
 *
 * The site ships with built-in content so it is never blank. That content is
 * only a fallback though, and the moment anything is published WordPress owns
 * the whole collection — which meant publishing your first listing replaced
 * forty of them with one. Importing the built-in content as real posts removes
 * that cliff edge: you start from a populated CMS and edit or delete entries
 * one at a time, like anything else.
 * ---------------------------------------------------------------------- */

const ILD_SEED_VERSION = 1;

function ild_seed_data(): ?array {
	$file = plugin_dir_path( __FILE__ ) . 'seed-content.json';
	if ( ! is_readable( $file ) ) {
		return null;
	}

	$data = json_decode( (string) file_get_contents( $file ), true );

	if ( ! is_array( $data ) || ( $data['version'] ?? 0 ) !== ILD_SEED_VERSION ) {
		return null;
	}

	return $data;
}

/** Turn a value from the JSON back into the textarea format the field expects. */
function ild_serialise( $value, array $field ): string {
	switch ( $field['type'] ) {
		case 'bool':
			return $value ? '1' : '';

		case 'lines':
			return is_array( $value ) ? implode( "\n", $value ) : (string) $value;

		case 'paras':
			return is_array( $value ) ? implode( "\n\n", $value ) : (string) $value;

		case 'pipe':
			if ( ! is_array( $value ) ) {
				return '';
			}
			$lines = array();
			foreach ( $value as $row ) {
				$cells = array();
				foreach ( $field['cols'] as $col ) {
					$cells[] = (string) ( $row[ $col ] ?? '' );
				}
				$lines[] = implode( '|', $cells );
			}
			return implode( "\n", $lines );

		default:
			return is_scalar( $value ) ? (string) $value : '';
	}
}

/**
 * Create one entry, or skip it if that slug already exists in that post type.
 *
 * Skipping rather than overwriting is deliberate: the importer can be re-run
 * after a partial import without trampling edits already made by hand.
 */
function ild_seed_entry( string $type, array $config, array $entry, int $order ): string {
	$slug = sanitize_title( $entry['slug'] ?? ( $entry[ $config['title_as'] ] ?? '' ) );
	if ( '' === $slug ) {
		return 'skipped';
	}

	$existing = get_posts(
		array(
			'post_type'        => $type,
			'name'             => $slug,
			'post_status'      => 'any',
			'numberposts'      => 1,
			'suppress_filters' => false,
		)
	);

	if ( $existing ) {
		return 'existed';
	}

	$post_id = wp_insert_post(
		array(
			'post_type'   => $type,
			'post_status' => 'publish',
			'post_title'  => (string) ( $entry[ $config['title_as'] ] ?? $slug ),
			'post_name'   => $slug,
			'menu_order'  => $order,
		),
		true
	);

	if ( is_wp_error( $post_id ) ) {
		return 'failed';
	}

	foreach ( $config['fields'] as $key => $field ) {
		if ( ! array_key_exists( $key, $entry ) ) {
			continue;
		}
		update_post_meta( $post_id, '_ild_' . $key, ild_serialise( $entry[ $key ], $field ) );
	}

	return 'created';
}

/** Build a WordPress menu from a nested structure and assign it to a location. */
function ild_seed_menu( string $location, string $name, array $items, bool $footer_style ): string {
	if ( ! $items ) {
		return 'skipped';
	}

	$locations = get_nav_menu_locations();
	if ( ! empty( $locations[ $location ] ) && wp_get_nav_menu_object( $locations[ $location ] ) ) {
		return 'existed';
	}

	$menu_id = wp_create_nav_menu( $name );
	if ( is_wp_error( $menu_id ) ) {
		return 'failed';
	}

	$add = function ( array $item, int $parent, int $order ) use ( $menu_id ) {
		return wp_update_nav_menu_item(
			$menu_id,
			0,
			array(
				'menu-item-title'     => $item['label'] ?? ( $item['heading'] ?? '' ),
				'menu-item-url'       => $item['href'] ?? '#',
				'menu-item-status'    => 'publish',
				'menu-item-type'      => 'custom',
				'menu-item-parent-id' => $parent,
				'menu-item-position'  => $order,
			)
		);
	};

	$position = 1;

	foreach ( $items as $item ) {
		if ( $footer_style ) {
			// Footer: heading at the top, its links as children.
			$parent = $add( array( 'label' => $item['heading'] ?? '', 'href' => '#' ), 0, $position++ );
			foreach ( $item['links'] ?? array() as $link ) {
				$add( $link, (int) $parent, $position++ );
			}
			continue;
		}

		// Main menu: item, then a heading per column, then that column's links.
		$top = $add( $item, 0, $position++ );

		foreach ( $item['columns'] ?? array() as $column ) {
			$heading = $add( array( 'label' => $column['heading'], 'href' => '#' ), (int) $top, $position++ );
			foreach ( $column['links'] ?? array() as $link ) {
				$add( $link, (int) $heading, $position++ );
			}
		}
	}

	$locations[ $location ] = (int) $menu_id;
	set_theme_mod( 'nav_menu_locations', $locations );

	return 'created';
}

/**
 * The demo photograph for a slug.
 *
 * Must stay in step with demoImage() in scripts/export-seed.ts, so a listing
 * keeps the same picture whether it arrived through the importer or the
 * backfill below.
 */
function ild_demo_image( string $slug ): string {
	return 'https://picsum.photos/seed/' . rawurlencode( $slug ) . '/1600/900';
}

/**
 * Give every listing that has no picture a demo one.
 *
 * Separate from the importer on purpose. The importer skips anything that
 * already exists, so that re-running it can never overwrite an edit — which
 * also means it cannot fill in a field that was added to the plugin after the
 * first import. That is exactly what happened with these photographs, so
 * backfilling needs its own explicit action rather than a change to the
 * importer's rules.
 *
 * Only ever fills blanks: a listing with a Featured Image or an Image URL
 * already set is left alone.
 */
function ild_backfill_demo_images(): array {
	$tally = array( 'filled' => 0, 'had_one' => 0 );

	$listings = get_posts(
		array(
			'post_type'        => 'ild_listing',
			'post_status'      => 'any',
			'numberposts'      => 500,
			'suppress_filters' => false,
		)
	);

	foreach ( $listings as $listing ) {
		$has_thumb = (bool) get_post_thumbnail_id( $listing->ID );
		$has_url   = '' !== trim( (string) get_post_meta( $listing->ID, '_ild_imageUrl', true ) );

		if ( $has_thumb || $has_url ) {
			$tally['had_one']++;
			continue;
		}

		update_post_meta( $listing->ID, '_ild_imageUrl', ild_demo_image( $listing->post_name ) );
		update_post_meta( $listing->ID, '_ild_imageCredit', 'Demo image — Lorem Picsum' );
		$tally['filled']++;
	}

	return $tally;
}

function ild_starter_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'You do not have permission to import content.' );
	}

	echo '<div class="wrap"><h1>Starter Content</h1>';

	$seed = ild_seed_data();

	if ( null === $seed ) {
		echo '<div class="notice notice-error"><p><strong>seed-content.json is missing or was produced by a different version of the site.</strong> Ask the developers for a matching plugin build.</p></div></div>';
		return;
	}

	if ( isset( $_POST['ild_backfill'] ) && check_admin_referer( 'ild_backfill_images' ) ) {
		$tally = ild_backfill_demo_images();
		echo '<div class="notice notice-success"><p><strong>' . (int) $tally['filled'] . ' listings given a demo photograph.</strong>';
		if ( $tally['had_one'] ) {
			echo ' ' . (int) $tally['had_one'] . ' already had one and were left alone.';
		}
		echo ' The site is rebuilding — allow two to four minutes.</p></div>';
		ild_trigger_deploy( 'demo images backfilled' );
	}

	if ( isset( $_POST['ild_import'] ) && check_admin_referer( 'ild_import_seed' ) ) {
		$with_placeholders = isset( $_POST['ild_placeholders'] );
		$report            = array();

		$collections = array(
			'ild_hub'     => $seed['hubs'] ?? array(),
			'ild_listing' => $seed['listings'] ?? array(),
			'ild_event'   => $seed['events'] ?? array(),
			'ild_deal'    => $seed['deals'] ?? array(),
			'ild_sponsor' => $seed['sponsors'] ?? array(),
			'ild_plan'    => $seed['plans'] ?? array(),
		);

		$schema = ild_schema();

		foreach ( $collections as $type => $entries ) {
			$tally = array( 'created' => 0, 'existed' => 0, 'failed' => 0, 'skipped' => 0 );

			foreach ( array_values( $entries ) as $i => $entry ) {
				// Fold the invented ratings back in only if explicitly asked for.
				if ( isset( $entry['__placeholders'] ) ) {
					if ( $with_placeholders ) {
						$entry = array_merge( $entry, $entry['__placeholders'] );
					}
					unset( $entry['__placeholders'] );
				}

				$result = ild_seed_entry( $type, $schema[ $type ], $entry, ( $i + 1 ) * 10 );
				$tally[ $result ]++;
			}

			$report[ $schema[ $type ]['plural'] ] = $tally;
		}

		$menus = $seed['menus'] ?? array();
		$report['Main menu']    = ild_seed_menu( 'ild_primary', 'I Love Durban — Main', $menus['primary'] ?? array(), false );
		$report['Footer menu']  = ild_seed_menu( 'ild_footer', 'I Love Durban — Footer', $menus['footer'] ?? array(), true );

		echo '<div class="notice notice-success"><p><strong>Import finished.</strong></p><ul style="list-style:disc;margin-left:2em">';
		foreach ( $report as $label => $tally ) {
			if ( is_array( $tally ) ) {
				echo '<li>' . esc_html( $label ) . ': ' . (int) $tally['created'] . ' created';
				if ( $tally['existed'] ) {
					echo ', ' . (int) $tally['existed'] . ' already there (left alone)';
				}
				if ( $tally['failed'] ) {
					echo ', <strong>' . (int) $tally['failed'] . ' failed</strong>';
				}
				echo '</li>';
			} else {
				echo '<li>' . esc_html( $label ) . ': ' . esc_html( $tally ) . '</li>';
			}
		}
		echo '</ul><p>The site is rebuilding — allow two to four minutes.</p></div>';

		ild_trigger_deploy( 'starter content imported' );
	}

	$counts = sprintf(
		'%d hubs, %d listings, %d events, %d deals, %d sponsors, %d business plans, and both menus',
		count( $seed['hubs'] ?? array() ),
		count( $seed['listings'] ?? array() ),
		count( $seed['events'] ?? array() ),
		count( $seed['deals'] ?? array() ),
		count( $seed['sponsors'] ?? array() ),
		count( $seed['plans'] ?? array() )
	);

	echo '<p>The site ships with built-in content so it is never blank, but that content lives in the code where you cannot touch it — and as soon as you publish one listing of your own, WordPress takes over the whole collection and the built-in ones disappear.</p>';
	echo '<p><strong>Importing brings it all in as ordinary posts</strong> (' . esc_html( $counts ) . '), so you start from something populated and edit or delete entries one at a time.</p>';
	echo '<p>Safe to run more than once: anything already present is left exactly as it is, so nothing you have edited gets overwritten.</p>';

	echo '<form method="post" style="margin-top:1.5em">';
	wp_nonce_field( 'ild_import_seed' );
	echo '<p><label><input type="checkbox" name="ild_placeholders" value="1" /> ';
	echo 'Also import demo photographs and placeholder ratings</label><br />';
	echo '<span class="description"><strong>For demos only.</strong> The venue names, areas and descriptions are real. The ratings and review counts are <strong>invented</strong>, and the photographs are generic stock from Lorem Picsum — <strong>not</strong> the venues\' own pictures, because republishing those from their websites would be copyright infringement. Leave this unticked for a real build: listings then arrive with no ratings and no photo, and the site shows a generated gradient instead of an empty space. Replace all of it with photos the businesses supply, licensed Google Places images, or a commissioned shoot.</span></p>';
	submit_button( 'Import starter content', 'primary', 'ild_import' );
	echo '</form>';

	/* ---- Backfill, for content imported before the photo fields existed ---- */

	$missing = 0;
	foreach ( get_posts( array( 'post_type' => 'ild_listing', 'post_status' => 'any', 'numberposts' => 500 ) ) as $listing ) {
		if ( ! get_post_thumbnail_id( $listing->ID ) && '' === trim( (string) get_post_meta( $listing->ID, '_ild_imageUrl', true ) ) ) {
			$missing++;
		}
	}

	echo '<hr style="margin:2em 0" /><h2>Fill in missing photographs</h2>';
	echo '<p>The importer never touches an entry that already exists, so it cannot fill in a field that was added to the plugin after your first import. Use this to give every listing that still has no picture a demo one.</p>';
	echo '<p><strong>' . (int) $missing . ' of your listings currently have no picture.</strong> Listings that already have a Featured Image or an Image URL are left alone.</p>';

	if ( $missing > 0 ) {
		echo '<form method="post">';
		wp_nonce_field( 'ild_backfill_images' );
		submit_button( 'Add demo photographs to those ' . (int) $missing . ' listings', 'secondary', 'ild_backfill' );
		echo '</form>';
	}

	echo '</div>';
}

/**
 * The form input name for a settings key.
 *
 * Settings keys are dotted ("site.tagline") because that is the shape the JSON
 * payload needs. They cannot be used as form field names as-is: PHP silently
 * rewrites "." to "_" in $_POST keys, so a field posted as "ild_site.tagline"
 * arrives as "ild_site_tagline" and a lookup by the original name finds
 * nothing — which read as "saving does nothing", because every field was then
 * stored as an empty string.
 *
 * Encoding the dot as a double underscore keeps the round trip lossless.
 */
function ild_field_name( string $key ): string {
	return 'ild_' . str_replace( '.', '__', $key );
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
				$name = ild_field_name( $key );

				// A field absent from the POST is left alone rather than blanked:
				// only fields the form actually rendered should be overwritten.
				if ( ! isset( $_POST[ $name ] ) ) {
					continue;
				}

				$settings[ $key ] = sanitize_textarea_field( wp_unslash( $_POST[ $name ] ) );
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
			$name  = ild_field_name( $key );

			echo '<tr><th scope="row"><label for="' . esc_attr( $name ) . '">' . esc_html( $field['label'] ) . '</label></th><td>';

			if ( 'text' === $field['type'] ) {
				echo '<input type="text" class="large-text" id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" />';
			} elseif ( 'select' === $field['type'] ) {
				echo '<select id="' . esc_attr( $name ) . '" name="' . esc_attr( $name ) . '">';
				// A blank first option means "leave it to the site's default".
				echo '<option value="">— use the site default —</option>';
				foreach ( $field['options'] as $option ) {
					echo '<option value="' . esc_attr( $option ) . '" ' . selected( $value, $option, false ) . '>' . esc_html( $option ) . '</option>';
				}
				echo '</select>';
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

	/*
	 * A Featured Image wins, but an image URL is accepted as a fallback so a
	 * photo hosted elsewhere — a licensed stock URL, a business's own CDN — can
	 * be used without first pulling it into the media library.
	 */
	$image = get_the_post_thumbnail_url( $post, 'full' );
	if ( ! $image && ! empty( $entry['imageUrl'] ) ) {
		$image = $entry['imageUrl'];
	}
	if ( $image ) {
		$entry['image'] = $image;
	}
	unset( $entry['imageUrl'] );

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

	$pages = ild_pages();
	if ( $pages ) {
		$payload['pages'] = $pages;
	}

	$nav = ild_primary_nav();
	if ( $nav ) {
		$payload['nav'] = $nav;
	}

	$footer = ild_footer_nav();
	if ( $footer ) {
		$payload['footer'] = $footer;
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

/** Editing a menu changes the site, so it should rebuild like content does. */
add_action( 'wp_update_nav_menu', 'ild_on_menu_change' );
function ild_on_menu_change(): void {
	ild_trigger_deploy( 'menu updated' );
}

add_action( 'transition_post_status', 'ild_on_transition', 10, 3 );
function ild_on_transition( string $new_status, string $old_status, WP_Post $post ): void {
	$watched   = array_keys( ild_schema() );
	$watched[] = 'post';
	$watched[] = 'page';

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
