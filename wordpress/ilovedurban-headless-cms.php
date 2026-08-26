<?php
/**
 * Plugin Name:  I Love Durban Headless CMS
 * Description:  Serves the I Love Durban directory as JSON and triggers a Cloudflare rebuild when content is published.
 * Version:      3.2.0
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
				'imageUrl'   => array( 'type' => 'text', 'label' => 'Tile image URL — shown on the "Explore Durban" tile. An alternative to the Featured Image.' ),
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
				'imageUrl'    => array( 'type' => 'text', 'label' => 'Image URL — an alternative to setting a Featured Image, for photos hosted elsewhere. The Featured Image wins if both are set.' ),
				'imageCredit' => array( 'type' => 'text', 'label' => 'Photo credit — required for anything not shot by us or supplied by the business.' ),
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
				'imageUrl'    => array( 'type' => 'text', 'label' => 'Image URL — an alternative to setting a Featured Image, for photos hosted elsewhere. The Featured Image wins if both are set.' ),
				'imageCredit' => array( 'type' => 'text', 'label' => 'Photo credit — required for anything not shot by us or supplied by the business.' ),
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
				'imageUrl'  => array( 'type' => 'text', 'label' => 'Background image URL — an alternative to the Featured Image. Sits under a dark scrim so the copy stays readable.' ),
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

/**
 * Published child pages of a page, for rendering it as a section index.
 *
 * Ordered the same way the Attractions menu orders its columns — the Order
 * field, then title — so the menu and the page agree.
 */
function ild_page_children( WP_Post $page ): array {
	$out = array();

	$children = get_posts(
		array(
			'post_type'        => 'page',
			'post_parent'      => $page->ID,
			'post_status'      => 'publish',
			'numberposts'      => 200,
			'orderby'          => array( 'menu_order' => 'ASC', 'title' => 'ASC' ),
			'suppress_filters' => false,
		)
	);

	foreach ( $children as $child ) {
		$path = trim( (string) get_page_uri( $child ), '/' );
		if ( '' === $path ) {
			continue;
		}

		$entry = array(
			'path'    => $path,
			'title'   => ild_text( get_the_title( $child ) ),
			'excerpt' => ild_text( wp_strip_all_tags( get_the_excerpt( $child ) ) ),
		);

		$image = get_the_post_thumbnail_url( $child, 'large' );
		if ( ! $image ) {
			$image = (string) get_post_meta( $child->ID, '_ild_page_image', true );
		}
		if ( $image ) {
			$entry['image'] = $image;
		}

		$out[] = $entry;
	}

	return $out;
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

		$html     = apply_filters( 'the_content', $page->post_content );
		$children = ild_page_children( $page );

		/*
		 * An empty page is normally not worth a URL — but a section page with
		 * children is, because it is the index for them. Three of the imported
		 * sections have no prose at all (the old theme generated their listing),
		 * and dropping them left the menu linking to 404s.
		 */
		if ( '' === trim( wp_strip_all_tags( $html ) ) && ! $children ) {
			continue;
		}

		$entry = array(
			'path'    => $path,
			'title'   => ild_text( get_the_title( $page ) ),
			'html'    => $html,
			'excerpt' => ild_text( wp_strip_all_tags( get_the_excerpt( $page ) ) ),
		);

		if ( $children ) {
			$entry['children'] = $children;
		}

		// A local thumbnail wins; imported pages fall back to the URL recorded
		// against them, since their media still lives on the source site.
		$image = get_the_post_thumbnail_url( $page, 'full' );
		if ( ! $image ) {
			$image = (string) get_post_meta( $page->ID, '_ild_page_image', true );
		}
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
		'Import from Live Site',
		'Import from Live Site',
		'manage_options',
		'ild-migrate',
		'ild_migrate_page'
	);

	add_submenu_page(
		ILD_MENU,
		'Attractions Menu',
		'Attractions Menu',
		'edit_theme_options',
		'ild-attractions-menu',
		'ild_attractions_menu_page'
	);

	add_submenu_page(
		ILD_MENU,
		'Copy Media',
		'Copy Media',
		'upload_files',
		'ild-media',
		'ild_media_page'
	);

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
/** Every post type that accepts an image URL — listings, events, deals, sponsors. */
function ild_image_post_types(): array {
	$types = array();

	foreach ( ild_schema() as $type => $config ) {
		if ( isset( $config['fields']['imageUrl'] ) ) {
			$types[ $type ] = $config['plural'];
		}
	}

	return $types;
}

/** Count entries with no picture, per post type. */
function ild_missing_images(): array {
	$counts = array();

	foreach ( ild_image_post_types() as $type => $plural ) {
		$missing = 0;

		foreach ( get_posts( array( 'post_type' => $type, 'post_status' => 'any', 'numberposts' => 500 ) ) as $post ) {
			if ( ! get_post_thumbnail_id( $post->ID ) && '' === trim( (string) get_post_meta( $post->ID, '_ild_imageUrl', true ) ) ) {
				$missing++;
			}
		}

		if ( $missing ) {
			$counts[ $plural ] = array( 'type' => $type, 'missing' => $missing );
		}
	}

	return $counts;
}

function ild_backfill_demo_images(): array {
	$report = array();

	foreach ( ild_image_post_types() as $type => $plural ) {
		$tally = array( 'filled' => 0, 'had_one' => 0 );

		$posts = get_posts(
			array(
				'post_type'        => $type,
				'post_status'      => 'any',
				'numberposts'      => 500,
				'suppress_filters' => false,
			)
		);

		foreach ( $posts as $post ) {
			$has_thumb = (bool) get_post_thumbnail_id( $post->ID );
			$has_url   = '' !== trim( (string) get_post_meta( $post->ID, '_ild_imageUrl', true ) );

			if ( $has_thumb || $has_url ) {
				$tally['had_one']++;
				continue;
			}

			// Seeded by slug, so an entry keeps the same picture between runs.
			update_post_meta( $post->ID, '_ild_imageUrl', ild_demo_image( $post->post_name ) );

			// Sponsors have no credit field — their panel has nowhere to show one.
			if ( isset( ild_schema()[ $type ]['fields']['imageCredit'] ) ) {
				update_post_meta( $post->ID, '_ild_imageCredit', 'Demo image — Lorem Picsum' );
			}

			$tally['filled']++;
		}

		if ( $tally['filled'] || $tally['had_one'] ) {
			$report[ $plural ] = $tally;
		}
	}

	return $report;
}

/* -------------------------------------------------------------------------
 * Migration from another WordPress site
 *
 * Pulls attraction pages and blog posts across from the old ilovedurban.co.za
 * over its public REST API. Slugs and parent/child structure are preserved, so
 * /durban/golden-mile/ stays /durban/golden-mile/ on the new site — the URLs
 * keep working and nothing needs redirecting.
 * ---------------------------------------------------------------------- */

const ILD_SOURCE_DEFAULT = 'https://www.ilovedurban.co.za';
const ILD_SOURCE_PARENTS = 'durban, south-coast, north-coast, kzn-and-midlands';

function ild_remote_json( string $url ) {
	$res = wp_remote_get( $url, array( 'timeout' => 30, 'headers' => array( 'Accept' => 'application/json' ) ) );

	if ( is_wp_error( $res ) || 200 !== (int) wp_remote_retrieve_response_code( $res ) ) {
		return null;
	}

	$data = json_decode( wp_remote_retrieve_body( $res ), true );

	return is_array( $data ) ? $data : null;
}

/**
 * Pull the actual article out of an Elementor page.
 *
 * The source site builds pages with Elementor, so content.rendered is ~25KB of
 * widget markup per page. Of that, roughly 58 links and 50 list items are the
 * theme's sidebar navigation rendered inline, and several blocks are advertiser
 * panels. Importing it verbatim gives you 124 pages of duplicated navigation
 * with the article buried inside.
 *
 * The prose always sits in the first `elementor-widget-text-editor` widget, so
 * that is what we take. Everything else — nav menus, ad panels, the container
 * scaffolding — is left behind, and wp_kses_post strips the remaining Elementor
 * attributes.
 *
 * If the markup ever stops matching, this returns an empty body rather than
 * guessing, and the caller falls back to importing the page whole.
 */
function ild_extract_article( string $html ): array {
	$body = '';

	if ( preg_match( '/elementor-widget-text-editor.*?<div class="elementor-widget-container">(.*?)<\/div>/s', $html, $match ) ) {
		$body = trim( $match[1] );
	}

	/*
	 * The first image is the article's own photograph. Later ones are advertiser
	 * creatives, which WordPress has resized — so anything carrying a
	 * "-520x397"-style dimension suffix is skipped.
	 */
	$image = '';

	if ( preg_match_all( '/<img[^>]*?src="([^"]+)"/', $html, $images ) ) {
		foreach ( $images[1] as $candidate ) {
			if ( ! preg_match( '/-\d{2,4}x\d{2,4}\.(jpe?g|png|webp|gif)$/i', $candidate ) ) {
				$image = $candidate;
				break;
			}
		}
	}

	return array(
		'html'  => $body ? wp_kses_post( $body ) : '',
		'image' => $image,
	);
}

/**
 * A summary taken from the extracted article.
 *
 * WordPress auto-generates an excerpt from the whole raw page when none is set,
 * which on these Elementor pages means it starts with the word "Menu" — it is
 * reading the navigation widget — and ends in a "[…]" marker. Taking the opening
 * of the actual prose instead gives a summary worth showing on a card.
 */
function ild_excerpt_from( string $html, int $length = 160 ): string {
	$text = ild_text( wp_strip_all_tags( $html ) );
	$text = preg_replace( '/\s+/', ' ', $text );

	if ( mb_strlen( $text ) <= $length ) {
		return $text;
	}

	$cut = mb_substr( $text, 0, $length );
	$gap = mb_strrpos( $cut, ' ' );

	// Trim to a word boundary rather than mid-word.
	return rtrim( false !== $gap ? mb_substr( $cut, 0, $gap ) : $cut, ' ,.;:' ) . '…';
}

/** The extracted article if the markup matched, otherwise the page as it came. */
function ild_article_or_raw( string $html ): string {
	$extracted = ild_extract_article( $html );

	return '' !== $extracted['html'] ? $extracted['html'] : $html;
}

/** Create one page from a remote REST record, or report that it already exists. */
function ild_import_page( array $remote, int $parent_id, string $source, bool $is_section = false ): array {
	$slug = sanitize_title( $remote['slug'] ?? '' );
	if ( '' === $slug ) {
		return array( 'status' => 'skipped', 'id' => 0 );
	}

	$existing = get_posts(
		array(
			'post_type'        => 'page',
			'name'             => $slug,
			'post_parent'      => $parent_id,
			'post_status'      => 'any',
			'numberposts'      => 1,
			'suppress_filters' => false,
		)
	);

	if ( $existing ) {
		return array( 'status' => 'existed', 'id' => (int) $existing[0]->ID );
	}

	$raw       = (string) ( $remote['content']['rendered'] ?? '' );
	$extracted = ild_extract_article( $raw );

	/*
	 * Section pages are imported empty on purpose, so they render purely as an
	 * index of their articles.
	 *
	 * Their source markup starts with the first attraction's widget, so
	 * extracting prose from /durban/ produced Golden Mile's article text — the
	 * section page ended up looking like a duplicate of one of its own children.
	 */
	if ( $is_section ) {
		$content = '';
	} else {
		// Fall back to the whole page if the markup did not match, rather than
		// importing an empty article.
		$content = '' !== $extracted['html'] ? $extracted['html'] : $raw;
	}

	$post_id = wp_insert_post(
		array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => ild_text( $remote['title']['rendered'] ?? $slug ),
			'post_name'    => $slug,
			'post_parent'  => $parent_id,
			'post_content' => $content,
			'post_excerpt' => ild_excerpt_from( '' !== $extracted['html'] ? $extracted['html'] : $raw ),
			'menu_order'   => (int) ( $remote['menu_order'] ?? 0 ),
		),
		true
	);

	if ( is_wp_error( $post_id ) ) {
		return array( 'status' => 'failed', 'id' => 0 );
	}

	/*
	 * Remember the source URL. The featured image lives on the old site and is
	 * not copied across, so the front end needs somewhere to read a remote URL
	 * from — and if anything looks wrong later, this says where it came from.
	 */
	update_post_meta( $post_id, '_ild_imported_from', esc_url_raw( $remote['link'] ?? $source ) );

	/*
	 * The article's own in-content image wins over the source site's featured
	 * image, which is not trustworthy: all 33 South Coast pages there share one
	 * placeholder (ushaka.webp) as their featured image, while their in-content
	 * images are correct and specific to each attraction.
	 */
	$image = $extracted['image'];
	if ( ! $image ) {
		$image = ild_remote_featured_image( $remote );
	}
	if ( $image ) {
		update_post_meta( $post_id, '_ild_page_image', esc_url_raw( $image ) );
	}

	return array( 'status' => 'created', 'id' => (int) $post_id );
}

/** Read the featured image URL out of an _embed-ed REST record. */
function ild_remote_featured_image( array $remote ): string {
	$media = $remote['_embedded']['wp:featuredmedia'][0]['source_url'] ?? '';

	return is_string( $media ) ? $media : '';
}

function ild_import_from_source( string $base, array $parent_slugs, bool $with_posts ): array {
	$base   = untrailingslashit( $base );
	$report = array();

	foreach ( $parent_slugs as $slug ) {
		$slug = sanitize_title( $slug );
		if ( '' === $slug ) {
			continue;
		}

		$found = ild_remote_json( $base . '/wp-json/wp/v2/pages?slug=' . $slug . '&_embed=wp:featuredmedia' );

		if ( ! $found || ! isset( $found[0]['id'] ) ) {
			$report[ $slug ] = 'not found on the source site';
			continue;
		}

		$parent = ild_import_page( $found[0], 0, $base, true );
		$tally  = array( 'created' => 0, 'existed' => 0, 'failed' => 0, 'skipped' => 0 );
		$tally[ $parent['status'] ]++;

		if ( ! $parent['id'] ) {
			$report[ $slug ] = 'could not create the section page';
			continue;
		}

		// 100 per page covers the largest section; loop in case that changes.
		for ( $page = 1; $page <= 5; $page++ ) {
			$children = ild_remote_json(
				$base . '/wp-json/wp/v2/pages?parent=' . (int) $found[0]['id']
				. '&per_page=100&page=' . $page . '&orderby=menu_order&order=asc&_embed=wp:featuredmedia'
			);

			if ( ! $children ) {
				break;
			}

			foreach ( $children as $child ) {
				$result = ild_import_page( $child, $parent['id'], $base );
				$tally[ $result['status'] ]++;
			}

			if ( count( $children ) < 100 ) {
				break;
			}
		}

		$report[ $slug ] = $tally;
	}

	if ( $with_posts ) {
		$tally = array( 'created' => 0, 'existed' => 0, 'failed' => 0, 'skipped' => 0 );

		for ( $page = 1; $page <= 5; $page++ ) {
			$posts = ild_remote_json(
				$base . '/wp-json/wp/v2/posts?per_page=100&page=' . $page . '&_embed=wp:featuredmedia'
			);

			if ( ! $posts ) {
				break;
			}

			foreach ( $posts as $remote ) {
				$slug = sanitize_title( $remote['slug'] ?? '' );
				if ( '' === $slug ) {
					$tally['skipped']++;
					continue;
				}

				$existing = get_posts( array( 'post_type' => 'post', 'name' => $slug, 'post_status' => 'any', 'numberposts' => 1 ) );
				if ( $existing ) {
					$tally['existed']++;
					continue;
				}

				$post_id = wp_insert_post(
					array(
						'post_type'    => 'post',
						'post_status'  => 'publish',
						'post_title'   => ild_text( $remote['title']['rendered'] ?? $slug ),
						'post_name'    => $slug,
						'post_content' => ild_article_or_raw( (string) ( $remote['content']['rendered'] ?? '' ) ),
						'post_excerpt' => ild_excerpt_from( (string) ( $remote['content']['rendered'] ?? '' ) ),
						'post_date'    => (string) ( $remote['date'] ?? '' ),
					),
					true
				);

				if ( is_wp_error( $post_id ) ) {
					$tally['failed']++;
					continue;
				}

				update_post_meta( $post_id, '_ild_imported_from', esc_url_raw( $remote['link'] ?? $base ) );

				$image = ild_remote_featured_image( $remote );
				if ( $image ) {
					update_post_meta( $post_id, '_ild_page_image', esc_url_raw( $image ) );
				}

				$tally['created']++;
			}

			if ( count( $posts ) < 100 ) {
				break;
			}
		}

		$report['blog posts'] = $tally;
	}

	return $report;
}

/* -------------------------------------------------------------------------
 * Media migration
 *
 * The content importer links images back to the source site rather than copying
 * them, which leaves the new site depending on the old one staying up. This
 * pulls every one of those files into this media library and rewrites the
 * references, so the old site can be switched off.
 *
 * Batched, because 124 articles carry several hundred images between them and a
 * single admin request would time out long before finishing.
 * ---------------------------------------------------------------------- */

const ILD_MEDIA_BATCH = 8;

/** Host whose images should be pulled local. Everything else is left alone. */
function ild_media_source_host(): string {
	$host = wp_parse_url( ILD_SOURCE_DEFAULT, PHP_URL_HOST );

	return is_string( $host ) ? $host : 'www.ilovedurban.co.za';
}

/**
 * Every distinct image URL still pointing at the source site.
 *
 * Looks in two places: the `src` attributes inside imported article HTML, and
 * the `_ild_page_image` meta the importer records for a featured image it could
 * not copy.
 */
function ild_media_pending(): array {
	global $wpdb;

	$host    = ild_media_source_host();
	$like    = '%' . $wpdb->esc_like( $host ) . '%';
	$pending = array();

	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT ID, post_content FROM {$wpdb->posts}
			 WHERE post_type IN ('page','post') AND post_status != 'trash' AND post_content LIKE %s",
			$like
		)
	);

	foreach ( $rows as $row ) {
		if ( preg_match_all( '/src="(https?:\/\/[^"]*' . preg_quote( $host, '/' ) . '[^"]+\.(?:jpe?g|png|webp|gif))"/i', $row->post_content, $found ) ) {
			foreach ( $found[1] as $url ) {
				$pending[ $url ] = true;
			}
		}
	}

	$metas = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT post_id, meta_value FROM {$wpdb->postmeta}
			 WHERE meta_key = '_ild_page_image' AND meta_value LIKE %s",
			$like
		)
	);

	foreach ( $metas as $meta ) {
		$pending[ $meta->meta_value ] = true;
	}

	return array_keys( $pending );
}

/**
 * Copy one image into the media library and repoint everything at it.
 *
 * Returns the new attachment ID, or 0 if the file could not be fetched — a
 * single missing image should not stop the run.
 */
function ild_media_adopt( string $url ): int {
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	global $wpdb;

	// Attach it to a post that actually uses it, so the library stays tidy.
	$owner = (int) $wpdb->get_var(
		$wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} WHERE post_content LIKE %s LIMIT 1",
			'%' . $wpdb->esc_like( $url ) . '%'
		)
	);

	if ( ! $owner ) {
		$owner = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_value = %s LIMIT 1", $url )
		);
	}

	$attachment_id = media_sideload_image( $url, $owner ?: 0, null, 'id' );

	if ( is_wp_error( $attachment_id ) ) {
		error_log( '[ilovedurban] could not copy ' . $url . ': ' . $attachment_id->get_error_message() );
		return 0;
	}

	$local = wp_get_attachment_url( (int) $attachment_id );
	if ( ! $local ) {
		return 0;
	}

	// Repoint article HTML.
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT ID, post_content FROM {$wpdb->posts} WHERE post_content LIKE %s",
			'%' . $wpdb->esc_like( $url ) . '%'
		)
	);

	foreach ( $rows as $row ) {
		wp_update_post(
			array(
				'ID'           => (int) $row->ID,
				'post_content' => str_replace( $url, $local, $row->post_content ),
			)
		);
	}

	/*
	 * Where this was standing in for a featured image, promote it to a real one
	 * and drop the meta — the front end prefers the thumbnail, so once it exists
	 * the remote fallback is dead weight.
	 */
	$holders = $wpdb->get_col(
		$wpdb->prepare( "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_ild_page_image' AND meta_value = %s", $url )
	);

	foreach ( $holders as $post_id ) {
		if ( ! get_post_thumbnail_id( (int) $post_id ) ) {
			set_post_thumbnail( (int) $post_id, (int) $attachment_id );
		}
		delete_post_meta( (int) $post_id, '_ild_page_image' );
	}

	return (int) $attachment_id;
}

/* -------------------------------------------------------------------------
 * Building the Attractions branch of the main menu
 *
 * 124 articles across four sections cannot all go in the dropdown — 34 links in
 * one column is a wall of text nobody reads. So each section becomes a column
 * showing a handful of its attractions, ending in a link through to the full
 * section page. The section pages themselves carry the complete lists.
 * ---------------------------------------------------------------------- */

const ILD_MENU_PER_SECTION = 8;

/** Every descendant of a menu item, deepest first so parents outlive children. */
function ild_menu_descendants( array $items, int $parent_id ): array {
	$found = array();
	$queue = array( $parent_id );

	while ( $queue ) {
		$current = array_shift( $queue );
		foreach ( $items as $item ) {
			if ( (int) $item->menu_item_parent === $current ) {
				$found[] = (int) $item->ID;
				$queue[] = (int) $item->ID;
			}
		}
	}

	return array_reverse( $found );
}

/** Add one item to a menu, returning its new ID. */
function ild_menu_add( int $menu_id, string $title, string $url, int $parent, int $position ) {
	return wp_update_nav_menu_item(
		$menu_id,
		0,
		array(
			'menu-item-title'     => $title,
			'menu-item-url'       => $url,
			'menu-item-status'    => 'publish',
			'menu-item-type'      => 'custom',
			'menu-item-parent-id' => $parent,
			'menu-item-position'  => $position,
		)
	);
}

/**
 * Put a top-level item's built-in dropdown back.
 *
 * Needed because building the Attractions tree under "Things to Do" replaced
 * that item's original columns — the hub filters — and there was no way to get
 * them back short of retyping them. The structure comes from the same
 * seed-content.json the Starter Content importer uses.
 */
function ild_restore_menu_branch( string $label ): array {
	$menu_id = ild_primary_menu_id();
	if ( ! $menu_id ) {
		return array( 'error' => 'No menu is assigned to the main menu location.' );
	}

	$seed = ild_seed_data();
	if ( null === $seed ) {
		return array( 'error' => 'seed-content.json is missing from the plugin.' );
	}

	$source = null;
	foreach ( $seed['menus']['primary'] ?? array() as $item ) {
		if ( 0 === strcasecmp( trim( $item['label'] ?? '' ), $label ) ) {
			$source = $item;
			break;
		}
	}

	if ( ! $source ) {
		return array( 'error' => '"' . $label . '" is not one of the built-in menu items.' );
	}

	$items  = wp_get_nav_menu_items( $menu_id ) ?: array();
	$target = null;

	foreach ( $items as $item ) {
		if ( 0 === (int) $item->menu_item_parent && 0 === strcasecmp( trim( $item->title ), $label ) ) {
			$target = $item;
			break;
		}
	}

	if ( ! $target ) {
		$new = ild_menu_add( $menu_id, $label, $source['href'] ?? '/', 0, 50 );
		if ( is_wp_error( $new ) ) {
			return array( 'error' => 'Could not create "' . $label . '".' );
		}
		$target_id = (int) $new;
	} else {
		$target_id = (int) $target->ID;
		foreach ( ild_menu_descendants( $items, $target_id ) as $id ) {
			wp_delete_post( $id, true );
		}
	}

	$position = 400;
	$columns  = 0;
	$links    = 0;

	foreach ( $source['columns'] ?? array() as $column ) {
		$heading = ild_menu_add( $menu_id, $column['heading'], '#', $target_id, $position++ );
		if ( is_wp_error( $heading ) ) {
			continue;
		}
		$columns++;

		foreach ( $column['links'] ?? array() as $link ) {
			ild_menu_add( $menu_id, $link['label'], $link['href'], (int) $heading, $position++ );
			$links++;
		}
	}

	return array( 'columns' => $columns, 'links' => $links );
}

/** The main menu's ID, or 0 if no menu is assigned to that location yet. */
function ild_primary_menu_id(): int {
	$locations = get_nav_menu_locations();
	$id        = (int) ( $locations['ild_primary'] ?? 0 );

	return ( $id && wp_get_nav_menu_object( $id ) ) ? $id : 0;
}

/** Published, top-level pages matching the given slugs, in the order given. */
function ild_section_pages( array $slugs ): array {
	$pages = array();

	foreach ( $slugs as $slug ) {
		$slug  = sanitize_title( $slug );
		$found = get_posts(
			array(
				'post_type'        => 'page',
				'name'             => $slug,
				'post_parent'      => 0,
				'post_status'      => 'publish',
				'numberposts'      => 1,
				'suppress_filters' => false,
			)
		);

		if ( $found ) {
			$pages[] = $found[0];
		}
	}

	return $pages;
}

/**
 * Rebuild the Attractions branch under a top-level menu item.
 *
 * Rebuilds rather than appends, so running it twice does not produce two of
 * everything. That does mean anything added under this item by hand is
 * replaced — the screen says so before you click.
 */
function ild_build_attractions_menu( string $parent_label, array $section_slugs, int $per_section ): array {
	$menu_id = ild_primary_menu_id();

	if ( ! $menu_id ) {
		return array( 'error' => 'No menu is assigned to the main menu location yet. Assign one in Appearance → Menus first, or run the Starter Content import, which creates both menus.' );
	}

	$sections = ild_section_pages( $section_slugs );

	if ( ! $sections ) {
		return array( 'error' => 'None of those section pages exist yet. Run "Import from Live Site" first.' );
	}

	$items = wp_get_nav_menu_items( $menu_id );
	$items = $items ? $items : array();

	// Find the top-level item to hang everything from, by title.
	$parent = null;
	foreach ( $items as $item ) {
		if ( 0 === (int) $item->menu_item_parent && 0 === strcasecmp( trim( $item->title ), $parent_label ) ) {
			$parent = $item;
			break;
		}
	}

	if ( ! $parent ) {
		/*
		 * Sits immediately after Things to Do when that exists, since the two
		 * belong together — attractions are things to do. Falls to the end of
		 * the bar otherwise.
		 */
		$after = 60;
		foreach ( $items as $item ) {
			if ( 0 === (int) $item->menu_item_parent && 0 === strcasecmp( trim( $item->title ), 'Things to Do' ) ) {
				$after = (int) $item->menu_order + 1;
				break;
			}
		}

		$new_id = ild_menu_add( $menu_id, $parent_label, '/' . sanitize_title( $section_slugs[0] ?? 'durban' ) . '/', 0, $after );

		if ( is_wp_error( $new_id ) ) {
			return array( 'error' => 'Could not create the "' . $parent_label . '" menu item.' );
		}

		$parent_id = (int) $new_id;

		// Shift everything that was at or after that slot down by one.
		foreach ( $items as $item ) {
			if ( 0 === (int) $item->menu_item_parent && (int) $item->menu_order >= $after ) {
				wp_update_post( array( 'ID' => (int) $item->ID, 'menu_order' => (int) $item->menu_order + 1 ) );
			}
		}
	} else {
		$parent_id = (int) $parent->ID;

		foreach ( ild_menu_descendants( $items, $parent_id ) as $id ) {
			wp_delete_post( $id, true );
		}
	}

	$position = 100;
	$report   = array();

	foreach ( $sections as $section ) {
		$heading = ild_menu_add( $menu_id, ild_text( get_the_title( $section ) ), '/' . $section->post_name . '/', $parent_id, $position++ );

		if ( is_wp_error( $heading ) ) {
			continue;
		}

		$children = get_posts(
			array(
				'post_type'        => 'page',
				'post_parent'      => $section->ID,
				'post_status'      => 'publish',
				'numberposts'      => $per_section,
				'orderby'          => array( 'menu_order' => 'ASC', 'title' => 'ASC' ),
				'suppress_filters' => false,
			)
		);

		foreach ( $children as $child ) {
			ild_menu_add( $menu_id, ild_text( get_the_title( $child ) ), '/' . $section->post_name . '/' . $child->post_name . '/', (int) $heading, $position++ );
		}

		$total = (int) ( new WP_Query(
			array(
				'post_type'      => 'page',
				'post_parent'    => $section->ID,
				'post_status'    => 'publish',
				'fields'         => 'ids',
				'posts_per_page' => -1,
			)
		) )->found_posts;

		// The column can only show a handful, so give people the way through to
		// the rest rather than pretending these are all of them.
		if ( $total > count( $children ) ) {
			ild_menu_add( $menu_id, 'All ' . $total . ' →', '/' . $section->post_name . '/', (int) $heading, $position++ );
		}

		$report[ ild_text( get_the_title( $section ) ) ] = array( 'shown' => count( $children ), 'total' => $total );
	}

	return array( 'sections' => $report );
}

function ild_attractions_menu_page(): void {
	if ( ! current_user_can( 'edit_theme_options' ) ) {
		wp_die( 'You do not have permission to edit menus.' );
	}

	echo '<div class="wrap"><h1>Build the Attractions menu</h1>';

	if ( isset( $_POST['ild_build_menu'] ) && check_admin_referer( 'ild_build_menu' ) ) {
		$label   = sanitize_text_field( wp_unslash( $_POST['ild_parent_label'] ?? 'Attractions' ) );
		$slugs   = array_filter( array_map( 'trim', explode( ',', sanitize_text_field( wp_unslash( $_POST['ild_sections'] ?? ILD_SOURCE_PARENTS ) ) ) ) );
		$per     = max( 1, min( 20, (int) ( $_POST['ild_per_section'] ?? ILD_MENU_PER_SECTION ) ) );
		$outcome = ild_build_attractions_menu( $label, $slugs, $per );

		if ( isset( $outcome['error'] ) ) {
			echo '<div class="notice notice-error"><p>' . esc_html( $outcome['error'] ) . '</p></div>';
		} else {
			echo '<div class="notice notice-success"><p><strong>Menu rebuilt under "' . esc_html( $label ) . '".</strong></p><ul style="list-style:disc;margin-left:2em">';
			foreach ( $outcome['sections'] as $name => $counts ) {
				echo '<li>' . esc_html( $name ) . ': ' . (int) $counts['shown'] . ' shown';
				if ( $counts['total'] > $counts['shown'] ) {
					echo ', with a link through to all ' . (int) $counts['total'];
				}
				echo '</li>';
			}
			echo '</ul>';

			if ( isset( $_POST['ild_restore_ttd'] ) ) {
				$restored = ild_restore_menu_branch( 'Things to Do' );
				if ( isset( $restored['error'] ) ) {
					echo '<p><strong>Things to Do was not restored:</strong> ' . esc_html( $restored['error'] ) . '</p>';
				} else {
					echo '<p><strong>Things to Do</strong> put back to its built-in dropdown: '
						. (int) $restored['columns'] . ' columns, ' . (int) $restored['links'] . ' links.</p>';
				}
			}

			echo '<p>The site is rebuilding — allow two to four minutes. Fine-tune the result in Appearance → Menus.</p></div>';
			ild_trigger_deploy( 'attractions menu rebuilt' );
		}
	}

	echo '<p>Adds an <strong>Attractions</strong> item to the main menu with a mega-menu flyout: each imported section becomes a column, listing a few of its attractions and ending in a link through to the full section page. It is placed immediately after Things to Do.</p>';
	echo '<p>All 124 cannot go in the dropdown — 34 links in one column is a wall of text nobody reads. The section pages carry the complete lists; the menu is for getting people started.</p>';
	echo '<p><strong>This rebuilds the branch rather than adding to it</strong>, so it is safe to run twice — but anything you have added under that menu item by hand will be replaced.</p>';

	echo '<form method="post"><table class="form-table"><tbody>';
	echo '<tr><th scope="row"><label for="ild_parent_label">Menu item to build under</label></th><td>';
	echo '<input type="text" class="regular-text" id="ild_parent_label" name="ild_parent_label" value="Attractions" />';
	echo '<p class="description">Matched by title in the main menu, and created as a new top-level item if it is not there.</p></td></tr>';
	echo '<tr><th scope="row"><label for="ild_sections">Sections</label></th><td>';
	echo '<input type="text" class="large-text code" id="ild_sections" name="ild_sections" value="' . esc_attr( ILD_SOURCE_PARENTS ) . '" />';
	echo '<p class="description">Comma-separated page slugs, in the order you want the columns.</p></td></tr>';
	echo '<tr><th scope="row"><label for="ild_per_section">Attractions per column</label></th><td>';
	echo '<input type="number" min="1" max="20" id="ild_per_section" name="ild_per_section" value="' . (int) ILD_MENU_PER_SECTION . '" />';
	echo '<p class="description">Ordered by the Order field, then title. Eight keeps four columns readable.</p></td></tr>';
	echo '<tr><th scope="row">Things to Do</th><td><label><input type="checkbox" name="ild_restore_ttd" value="1" checked /> ';
	echo 'Put Things to Do back to its built-in dropdown</label>';
	echo '<p class="description">An earlier version of this tool built the attraction columns under Things to Do, which replaced its original columns of hub filters. Leave this ticked to restore them.</p></td></tr>';
	echo '</tbody></table>';
	wp_nonce_field( 'ild_build_menu' );
	submit_button( 'Build the menu', 'primary', 'ild_build_menu' );
	echo '</form></div>';
}

function ild_media_page(): void {
	if ( ! current_user_can( 'upload_files' ) ) {
		wp_die( 'You do not have permission to import media.' );
	}

	$host    = ild_media_source_host();
	$running = isset( $_GET['run'] ) && check_admin_referer( 'ild_media_run' );

	echo '<div class="wrap"><h1>Copy media from the old site</h1>';

	if ( $running ) {
		$pending = ild_media_pending();
		$batch   = array_slice( $pending, 0, ILD_MEDIA_BATCH );
		$done    = 0;
		$failed  = 0;

		foreach ( $batch as $url ) {
			if ( ild_media_adopt( $url ) ) {
				$done++;
			} else {
				$failed++;
			}
		}

		$left = max( 0, count( $pending ) - count( $batch ) );

		echo '<div class="notice notice-info"><p><strong>' . (int) $done . ' copied</strong>';
		if ( $failed ) {
			echo ', <strong>' . (int) $failed . ' could not be fetched</strong> (see the error log)';
		}
		echo ' — ' . (int) $left . ' still to go.</p></div>';

		if ( $left > 0 && $done > 0 ) {
			$next = wp_nonce_url( admin_url( 'admin.php?page=ild-media&run=1' ), 'ild_media_run' );
			// Continues on its own; a stalled run just stops rather than looping.
			echo '<meta http-equiv="refresh" content="1;url=' . esc_url( $next ) . '" />';
			echo '<p>Carrying on automatically — leave this page open.</p>';
		} elseif ( $left > 0 ) {
			echo '<p><strong>Stopped.</strong> Nothing in the last batch could be fetched, so it is not worth continuing blindly. Check that ' . esc_html( $host ) . ' is still reachable, then start again.</p>';
		} else {
			echo '<p><strong>Finished. Nothing on this site points at ' . esc_html( $host ) . ' any more</strong> — it is safe to switch the old site off.</p>';
			ild_trigger_deploy( 'media migrated' );
		}
	}

	$pending = ild_media_pending();

	echo '<p>The content importer links images back to <code>' . esc_html( $host ) . '</code> rather than copying them, which leaves this site depending on that one staying up. This pulls those files into your own media library and rewrites every reference to them.</p>';
	echo '<p><strong>' . count( $pending ) . ' images still point at the old site.</strong></p>';

	if ( $pending ) {
		echo '<p>It works in batches of ' . (int) ILD_MEDIA_BATCH . ' and continues on its own — several hundred images would time out in one request. Leave the page open until it says it has finished. Safe to stop and resume: anything already copied is skipped.</p>';
		echo '<p><em>' . esc_html( $host ) . ' has to stay online until this finishes.</em></p>';
		echo '<a class="button button-primary" href="' . esc_url( wp_nonce_url( admin_url( 'admin.php?page=ild-media&run=1' ), 'ild_media_run' ) ) . '">Start copying</a>';
		echo '<h2 style="margin-top:2em">First few still to copy</h2><ol>';
		foreach ( array_slice( $pending, 0, 8 ) as $url ) {
			echo '<li><code>' . esc_html( basename( wp_parse_url( $url, PHP_URL_PATH ) ) ) . '</code></li>';
		}
		echo '</ol>';
	} else {
		echo '<p>Nothing to do — no content on this site references the old one.</p>';
	}

	echo '</div>';
}

/**
 * Repair pages that were already imported.
 *
 * The importer skips anything that exists, so a change to how it picks images
 * or handles section pages cannot reach content that came across earlier. This
 * re-reads each section from the source and applies the current rules.
 *
 * Cheap enough for one request: the source API returns a whole section's
 * children in a single call, so this is four or five requests, not one per page.
 */
function ild_repair_imported( string $base, array $parent_slugs, bool $force_images = false ): array {
	$base   = untrailingslashit( $base );
	$report = array();

	foreach ( $parent_slugs as $slug ) {
		$slug = sanitize_title( $slug );
		if ( '' === $slug ) {
			continue;
		}

		$local_section = get_posts(
			array(
				'post_type'        => 'page',
				'name'             => $slug,
				'post_parent'      => 0,
				'post_status'      => 'any',
				'numberposts'      => 1,
				'suppress_filters' => false,
			)
		);

		if ( ! $local_section ) {
			$report[ $slug ] = 'not imported here yet';
			continue;
		}

		$section  = $local_section[0];
		$cleared  = false;
		$repaired = 0;

		/*
		 * A section page is an index. Both its body and its excerpt were taken
		 * from the first article, so both go.
		 */
		if ( '' !== trim( wp_strip_all_tags( $section->post_content ) ) || '' !== trim( (string) $section->post_excerpt ) ) {
			wp_update_post( array( 'ID' => $section->ID, 'post_content' => '', 'post_excerpt' => '' ) );
			$cleared = true;
		}

		$remote_section = ild_remote_json( $base . '/wp-json/wp/v2/pages?slug=' . $slug . '&_fields=id' );
		if ( ! $remote_section || ! isset( $remote_section[0]['id'] ) ) {
			$report[ $slug ] = 'could not read the section from the source site';
			continue;
		}

		for ( $page = 1; $page <= 5; $page++ ) {
			$children = ild_remote_json(
				$base . '/wp-json/wp/v2/pages?parent=' . (int) $remote_section[0]['id']
				. '&per_page=100&page=' . $page . '&_fields=slug,content'
			);

			if ( ! $children ) {
				break;
			}

			foreach ( $children as $child ) {
				$child_slug = sanitize_title( $child['slug'] ?? '' );
				if ( '' === $child_slug ) {
					continue;
				}

				$local = get_posts(
					array(
						'post_type'        => 'page',
						'name'             => $child_slug,
						'post_parent'      => $section->ID,
						'post_status'      => 'any',
						'numberposts'      => 1,
						'suppress_filters' => false,
					)
				);

				if ( ! $local ) {
					continue;
				}

				$extracted = ild_extract_article( (string) ( $child['content']['rendered'] ?? '' ) );

				/*
				 * Normally a local Featured Image is left alone. But if Copy
				 * Media ran before this fix existed, the wrong image was already
				 * pulled local and set as the thumbnail — so there is a real
				 * Featured Image standing in the way of the correction. Forcing
				 * unsets it and points the page back at the right source, ready
				 * for Copy Media to localise.
				 */
				$blocked = get_post_thumbnail_id( $local[0]->ID ) && ! $force_images;

				if ( '' === $extracted['image'] || $blocked ) {
					$summary = ild_excerpt_from( '' !== $extracted['html'] ? $extracted['html'] : (string) ( $child['content']['rendered'] ?? '' ) );
					if ( '' !== $summary ) {
						wp_update_post( array( 'ID' => $local[0]->ID, 'post_excerpt' => $summary ) );
					}
					continue;
				}

				if ( $force_images ) {
					delete_post_thumbnail( $local[0]->ID );
				}

				update_post_meta( $local[0]->ID, '_ild_page_image', esc_url_raw( $extracted['image'] ) );

				// Replace the auto-excerpt that starts with "Menu" and ends "[…]".
				$summary = ild_excerpt_from( '' !== $extracted['html'] ? $extracted['html'] : (string) ( $child['content']['rendered'] ?? '' ) );
				if ( '' !== $summary ) {
					wp_update_post( array( 'ID' => $local[0]->ID, 'post_excerpt' => $summary ) );
				}

				$repaired++;
			}

			if ( count( $children ) < 100 ) {
				break;
			}
		}

		$report[ $slug ] = array( 'images' => $repaired, 'cleared' => $cleared );
	}

	return $report;
}

function ild_migrate_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'You do not have permission to import content.' );
	}

	echo '<div class="wrap"><h1>Import from the live site</h1>';

	if ( isset( $_POST['ild_migrate'] ) && check_admin_referer( 'ild_migrate_source' ) ) {
		$base    = esc_url_raw( wp_unslash( $_POST['ild_source'] ?? ILD_SOURCE_DEFAULT ) );
		$parents = array_filter( array_map( 'trim', explode( ',', sanitize_text_field( wp_unslash( $_POST['ild_parents'] ?? ILD_SOURCE_PARENTS ) ) ) ) );
		$posts   = isset( $_POST['ild_with_posts'] );

		$report = ild_import_from_source( $base, $parents, $posts );

		echo '<div class="notice notice-success"><p><strong>Import finished.</strong></p><ul style="list-style:disc;margin-left:2em">';
		foreach ( $report as $label => $tally ) {
			if ( is_array( $tally ) ) {
				echo '<li><code>' . esc_html( $label ) . '</code>: ' . (int) $tally['created'] . ' created';
				if ( $tally['existed'] ) {
					echo ', ' . (int) $tally['existed'] . ' already there';
				}
				if ( $tally['failed'] ) {
					echo ', <strong>' . (int) $tally['failed'] . ' failed</strong>';
				}
				echo '</li>';
			} else {
				echo '<li><code>' . esc_html( $label ) . '</code>: ' . esc_html( $tally ) . '</li>';
			}
		}
		echo '</ul><p>The site is rebuilding — allow two to four minutes.</p></div>';

		ild_trigger_deploy( 'content imported from source site' );
	}

	echo '<p>Copies the attraction pages and blog posts across from the old site over its public API. <strong>Slugs and section structure are preserved</strong>, so <code>/durban/golden-mile/</code> stays exactly that — the existing links keep working and nothing needs redirecting.</p>';
	echo '<p>Safe to run more than once: a page that already exists is left alone, so an interrupted run can simply be repeated.</p>';
	echo '<p><strong>Images are not copied.</strong> Featured images are linked back to the source site, and pictures inside the article text keep pointing there too. That works as long as the old site stays up — move the media over properly before switching it off.</p>';

	if ( isset( $_POST['ild_repair'] ) && check_admin_referer( 'ild_repair_imported' ) ) {
		$base    = esc_url_raw( wp_unslash( $_POST['ild_source'] ?? ILD_SOURCE_DEFAULT ) );
		$parents = array_filter( array_map( 'trim', explode( ',', sanitize_text_field( wp_unslash( $_POST['ild_parents'] ?? ILD_SOURCE_PARENTS ) ) ) ) );
		$report  = ild_repair_imported( $base, $parents, isset( $_POST['ild_force_images'] ) );

		echo '<div class="notice notice-success"><p><strong>Repair finished.</strong></p><ul style="list-style:disc;margin-left:2em">';
		foreach ( $report as $slug => $result ) {
			if ( is_array( $result ) ) {
				echo '<li><code>' . esc_html( $slug ) . '</code>: ' . (int) $result['images'] . ' images corrected';
				if ( $result['cleared'] ) {
					echo ', and its own borrowed article text cleared so it renders as an index';
				}
				echo '</li>';
			} else {
				echo '<li><code>' . esc_html( $slug ) . '</code>: ' . esc_html( $result ) . '</li>';
			}
		}
		echo '</ul><p>The site is rebuilding — allow two to four minutes.</p></div>';

		ild_trigger_deploy( 'imported content repaired' );
	}

	echo '<form method="post"><table class="form-table"><tbody>';
	echo '<tr><th scope="row"><label for="ild_source">Source site</label></th><td>';
	echo '<input type="url" class="large-text code" id="ild_source" name="ild_source" value="' . esc_attr( ILD_SOURCE_DEFAULT ) . '" /></td></tr>';
	echo '<tr><th scope="row"><label for="ild_parents">Sections to import</label></th><td>';
	echo '<input type="text" class="large-text code" id="ild_parents" name="ild_parents" value="' . esc_attr( ILD_SOURCE_PARENTS ) . '" />';
	echo '<p class="description">Comma-separated page slugs. These four hold the 124 attraction articles; everything else on the old site is theme demo pages and shop scaffolding, which is why they are not listed here.</p></td></tr>';
	echo '<tr><th scope="row">Blog</th><td><label><input type="checkbox" name="ild_with_posts" value="1" checked /> Also import the blog posts</label></td></tr>';
	echo '</tbody></table>';
	wp_nonce_field( 'ild_migrate_source' );
	submit_button( 'Import content', 'primary', 'ild_migrate' );
	echo '</form>';

	echo '<hr style="margin:2em 0" /><h2>Fix content imported earlier</h2>';
	echo '<p>The importer never touches a page that already exists, so improvements to it cannot reach content that came across before. Run this once after upgrading the plugin. It fixes two things:</p>';
	echo '<ul style="list-style:disc;margin-left:2em">';
	echo '<li><strong>Wrong featured images.</strong> The old site sets the same placeholder as the featured image on every South Coast page, so all 33 arrived showing the same picture. Each article\'s own in-content image is correct and specific, and is now used instead.</li>';
	echo '<li><strong>Section pages showing an article.</strong> The source markup for a section page starts with its first attraction, so <code>/durban/</code> ended up displaying Golden Mile\'s text. Section pages are cleared so they render purely as an index of their articles.</li>';
	echo '</ul>';
	echo '<p>A page where you have set a Featured Image by hand is left alone — unless you tick the box below.</p>';
	echo '<form method="post">';
	echo '<p><label><input type="checkbox" name="ild_force_images" value="1" /> ';
	echo 'Replace images even where one is already set</label><br />';
	echo '<span class="description">Needed if <strong>Copy Media</strong> ran before this fix existed. In that case the wrong image was already pulled into your library and set as the Featured Image, so there is nothing "missing" for the fix to fill — it has to be told to overwrite. Ticking this unsets those images and points the pages back at the correct source; <strong>run Copy Media again afterwards</strong> to pull the right files in.</span></p>';
	echo '<input type="hidden" name="ild_source" value="' . esc_attr( ILD_SOURCE_DEFAULT ) . '" />';
	echo '<input type="hidden" name="ild_parents" value="' . esc_attr( ILD_SOURCE_PARENTS ) . '" />';
	wp_nonce_field( 'ild_repair_imported' );
	submit_button( 'Fix imported pages', 'secondary', 'ild_repair' );
	echo '</form></div>';
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
		$report = ild_backfill_demo_images();
		echo '<div class="notice notice-success"><p><strong>Demo photographs added.</strong></p><ul style="list-style:disc;margin-left:2em">';
		foreach ( $report as $plural => $tally ) {
			echo '<li>' . esc_html( $plural ) . ': ' . (int) $tally['filled'] . ' given a picture';
			if ( $tally['had_one'] ) {
				echo ', ' . (int) $tally['had_one'] . ' already had one';
			}
			echo '</li>';
		}
		echo '</ul><p>The site is rebuilding — allow two to four minutes.</p></div>';
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

	$counts = ild_missing_images();
	$total  = 0;
	foreach ( $counts as $row ) {
		$total += $row['missing'];
	}

	echo '<hr style="margin:2em 0" /><h2>Fill in missing photographs</h2>';
	echo '<p>The importer never touches an entry that already exists, so it cannot fill in a field that was added to the plugin after your first import. Use this to give everything that still has no picture a demo one — listings, events, deals and sponsor banners.</p>';

	if ( $total > 0 ) {
		echo '<p><strong>' . (int) $total . ' entries currently have no picture:</strong></p><ul style="list-style:disc;margin-left:2em">';
		foreach ( $counts as $plural => $row ) {
			echo '<li>' . esc_html( $plural ) . ': ' . (int) $row['missing'] . '</li>';
		}
		echo '</ul><p>Anything with a Featured Image or an Image URL already set is left alone.</p>';
		echo '<form method="post">';
		wp_nonce_field( 'ild_backfill_images' );
		submit_button( 'Add demo photographs to those ' . (int) $total . ' entries', 'secondary', 'ild_backfill' );
		echo '</form>';
	} else {
		echo '<p>Everything already has a picture.</p>';
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
		if ( ! $image ) {
			$image = (string) get_post_meta( $post->ID, '_ild_page_image', true );
		}
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
