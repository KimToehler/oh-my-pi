#!/usr/bin/env bash
# Minimal container-runtime stand-in for tests: no Docker daemon is needed. It models what matters to
# calibration: the image holds only the Dockerfile's COPY'd repo, mounts are the only bridge to the host, and the
# process sees a scrubbed environment (no host PATH additions, no host env vars). It cannot enforce network
# isolation; tests assert the `--network none` argv instead.
set -eu
state="${FAKE_DOCKER_STATE:?}"
mkdir -p "$state/images"
echo "$*" >> "$state/calls.log"
case "$1" in
build)
	tag=""
	shift
	while [ $# -gt 1 ]; do
		case "$1" in
		-t) tag="$2"; shift 2 ;;
		*) shift ;;
		esac
	done
	ctx="$1"
	rm -rf "$state/images/$tag"
	mkdir -p "$state/images/$tag"
	cp -R "$ctx/repo" "$state/images/$tag/repo"
	;;
image)
	# image inspect --format <fmt> <ref>. A RepoDigests lookup models a registry-resolved reference: a deterministic
	# digest per ref, salted by FAKE_IMAGE_SALT so a test can move a mutable tag between two resolutions.
	shift
	case "$*" in
	*RepoDigests*)
		ref="${!#}"
		digest="$(printf '%s%s' "$ref" "${FAKE_IMAGE_SALT:-}" | shasum -a 256 | cut -d' ' -f1)"
		echo "${ref%%[:@]*}@sha256:$digest"
		;;
	*) echo "sha256:fake-${!#}" ;;
	esac
	;;
pull)
	exit 0
	;;
run)
	shift
	tests="" logs="" solution=""
	while [ $# -gt 0 ]; do
		case "$1" in
		--rm) shift ;;
		--network) shift 2 ;;
		-v)
			host="${2%%:*}"
			rest="${2#*:}"
			case "${rest%%:*}" in
			/tests) tests="$host" ;;
			/logs/verifier) logs="$host" ;;
			/solution) solution="$host" ;;
			esac
			shift 2
			;;
		*) break ;;
		esac
	done
	image="$1"
	shift
	scratch="$(mktemp -d)"
	cp -R "$state/images/$image/repo" "$scratch/repo"
	args=()
	for a in "$@"; do
		a="${a//\/tests\//$tests/}"
		a="${a//\/solution\//$solution/}"
		args+=("$a")
	done
	set +e
	env -i PATH=/usr/bin:/bin HOME="$scratch" REPO_DIR="$scratch/repo" TESTS_DIR="$tests" LOG_DIR="$logs" \
		SOLUTION_DIR="$solution" "${args[@]}"
	code=$?
	rm -rf "$scratch"
	exit $code
	;;
*)
	echo "fake-docker: unsupported $*" >&2
	exit 2
	;;
esac
