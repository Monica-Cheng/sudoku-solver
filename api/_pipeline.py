"""TensorFlow-free computer-vision pipeline: photo -> 81 deskewed cell images.

Lifted verbatim (behaviour-wise) from cnn/sudoku_utils.py, with
the TensorFlow / matplotlib / imutils / file-I/O / print()s removed.

Dependencies: opencv-python-headless, numpy.

    cells = extract_cells(image_bgr)        # list of 81 dicts, row-major
    # each: {"img": uint8 (28,28), "contains_digit": bool,
    #        "x_centroid": int, "y_centroid": int}

Raises GridNotFound when the grid can't be located or doesn't yield exactly
81 cells (about 1 image in 26, per the Phase 0 survey).
"""
from __future__ import annotations

import cv2
import numpy as np

RESIZE_WIDTH = 1000


class GridNotFound(Exception):
    """The Sudoku grid could not be located, or did not segment into 81 cells."""


def _grab_contours(cnts):
    # imutils.grab_contours: cv2.findContours returns (contours, hierarchy) on
    # OpenCV 4.x and (image, contours, hierarchy) on 3.x.
    if len(cnts) == 2:
        return cnts[0]
    if len(cnts) == 3:
        return cnts[1]
    raise ValueError("unexpected cv2.findContours return arity")


def resize_and_maintain_aspect_ratio(input_image, new_width):
    orig_width, orig_height = input_image.shape[1], input_image.shape[0]
    ratio = new_width / float(orig_width)
    new_height = int(orig_height * ratio)
    return cv2.resize(input_image, (new_width, new_height), interpolation=cv2.INTER_AREA)


def apply_grayscale_blur_and_threshold(img, method="mean", blocksize=91, c=7):
    img = cv2.GaussianBlur(img, ksize=(3, 3), sigmaX=0)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    adaptive_method = (
        cv2.ADAPTIVE_THRESH_MEAN_C if method == "mean" else cv2.ADAPTIVE_THRESH_GAUSSIAN_C
    )
    thresh = cv2.adaptiveThreshold(
        gray, 255, adaptive_method, cv2.THRESH_BINARY, blocksize, c
    )
    return cv2.bitwise_not(thresh)


def get_quadrilateral_points_in_order(approx_arr):
    if approx_arr.shape not in ((4, 1, 2), (4, 2)):
        raise ValueError(f"Incorrect shape for approx_arr: {approx_arr.shape}.")
    if approx_arr.shape == (4, 1, 2):
        approx_arr = np.squeeze(approx_arr, axis=1)

    max_x = int(1.1 * np.max(approx_arr[:, 0]))
    origin_1 = [0, 0]
    origin_2 = [max_x, 0]
    distances_1 = [np.linalg.norm(point - origin_1) for point in approx_arr]
    distances_2 = [np.linalg.norm(point - origin_2) for point in approx_arr]

    tl_idx = int(np.argmin(distances_1))
    br_idx = int(np.argmax(distances_1))

    dist_arr = distances_2.copy()
    dist_arr[tl_idx] = np.inf
    dist_arr[br_idx] = np.inf
    tr_idx = int(np.argmin(dist_arr))

    dist_arr = distances_2.copy()
    dist_arr[tl_idx] = -np.inf
    dist_arr[br_idx] = -np.inf
    bl_idx = int(np.argmax(dist_arr))

    return np.array(
        [approx_arr[tl_idx], approx_arr[tr_idx], approx_arr[br_idx], approx_arr[bl_idx]]
    )


def perform_four_point_transform(input_img, src_corners, pad=10):
    src_corners = get_quadrilateral_points_in_order(src_corners).astype("float32")
    tl, tr, br, bl = src_corners

    bottom_width = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    top_width = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    max_width = max(int(bottom_width), int(top_width))

    left_height = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    right_height = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    max_height = max(int(left_height), int(right_height))

    dest_img_corners = np.array(
        [
            [0 + pad, 0 + pad],
            [max_width - 1 - pad, 0 + pad],
            [max_width - 1 - pad, max_height - 1 - pad],
            [0 + pad, max_height - 1 - pad],
        ],
        dtype="float32",
    )
    M = cv2.getPerspectiveTransform(src=src_corners, dst=dest_img_corners)
    warped_img = cv2.warpPerspective(input_img, M, (max_width, max_height))
    return M, warped_img


def find_grid_contour_candidates(img):
    m_matrices, warped_images, contour_grid_candidates = [], [], []
    img_area = img.shape[0] * img.shape[1]
    thresh = apply_grayscale_blur_and_threshold(img, blocksize=41, c=8)
    contours = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        contours = _grab_contours(contours)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        for contour in contours:
            perimeter = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.03 * perimeter, True)
            contour_fractional_area = cv2.contourArea(contour) / img_area
            if len(approx) == 4 and contour_fractional_area > 0.1:
                approx = get_quadrilateral_points_in_order(approx)
                M, warped_img = perform_four_point_transform(img, approx, pad=30)
                m_matrices.append(M)
                warped_images.append(warped_img)
                contour_grid_candidates.append(contour)

    if not warped_images:
        raise GridNotFound("no grid contour candidates were found in image")
    return m_matrices, warped_images, contour_grid_candidates


def check_for_digit_in_cell_image(img, area_threshold=5, apply_border=False):
    cell_img = img.copy()
    if apply_border:
        border_fraction = 0.07
        y_border_px = int(border_fraction * cell_img.shape[0])
        x_border_px = int(border_fraction * cell_img.shape[1])
        cell_img[:, 0:x_border_px] = 0
        cell_img[:, -x_border_px:] = 0
        cell_img[0:y_border_px, :] = 0
        cell_img[-y_border_px:, :] = 0

    contours = cv2.findContours(cell_img, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    contours = _grab_contours(contours)

    image_contains_digit = False
    if len(contours) > 0:
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        largest_contour_area = cv2.contourArea(contours[0])
        image_area = cell_img.shape[0] * cell_img.shape[1]
        contour_percentage_area = 100 * largest_contour_area / image_area
        image_contains_digit = contour_percentage_area > area_threshold

    return image_contains_digit, cell_img


def locate_cells_within_grid(grid_img):
    valid_cells = []
    grid_area = grid_img.shape[0] * grid_img.shape[1]
    grid_img = apply_grayscale_blur_and_threshold(grid_img, method="mean", blocksize=91, c=7)
    contours = cv2.findContours(grid_img.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)

    if not contours:
        return valid_cells
    contours = _grab_contours(contours)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    for contour in contours:
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.03 * perimeter, True)
        contour_fractional_area = cv2.contourArea(contour) / grid_area
        if len(approx) == 4 and 0.005 < contour_fractional_area < 0.015:
            mask = np.zeros_like(grid_img)
            cv2.drawContours(mask, [contour], 0, 255, thickness=cv2.FILLED)
            y_px, x_px = np.where(mask == 255)
            cell_image = grid_img[min(y_px):max(y_px) + 1, min(x_px):max(x_px) + 1]
            digit_is_present, cell_image = check_for_digit_in_cell_image(
                cell_image, area_threshold=5, apply_border=True
            )
            kernel = np.ones((3, 3), np.uint8)
            cell_image = cv2.erode(cell_image, kernel, iterations=1)
            cell_image = cv2.resize(cell_image, (28, 28), interpolation=cv2.INTER_AREA)
            moments = cv2.moments(contour)
            valid_cells.append(
                {
                    "img": cell_image,
                    "contains_digit": digit_is_present,
                    "x_centroid": int(moments["m10"] / moments["m00"]),
                    "y_centroid": int(moments["m01"] / moments["m00"]),
                }
            )
    return valid_cells


def sort_cells_into_grid(cells):
    x_vals = [cell["x_centroid"] for cell in cells]
    y_vals = [cell["y_centroid"] for cell in cells]
    points = np.array([[cell["x_centroid"], cell["y_centroid"]] for cell in cells])
    points_sorted = np.array(sorted(points, key=lambda p: p[1]))
    rows = np.reshape(points_sorted, (9, 9, 2))
    final = np.array([sorted(row, key=lambda p: p[0]) for row in rows])
    final_reshaped = np.reshape(final, (81, 2))

    for i in range(len(x_vals)):
        if not any(np.equal(final_reshaped, [x_vals[i], y_vals[i]]).all(1)):
            raise GridNotFound("cell centroids did not sort into a 9x9 grid")

    indices = []
    for x, y in final_reshaped:
        x_indices = np.where(np.array(x_vals) == x)
        y_indices = np.where(np.array(y_vals) == y)
        indices.append(int(np.intersect1d(x_indices, y_indices)[0]))
    return [cells[idx] for idx in indices]


def get_valid_cells_from_image(img):
    """img: RGB, already resized. Returns (sorted_cells, M, grid_image)."""
    m_matrices, warped_images, _ = find_grid_contour_candidates(img)
    for i, grid_image in enumerate(warped_images):
        valid_cells = locate_cells_within_grid(grid_image)
        if len(valid_cells) == 81:
            return sort_cells_into_grid(valid_cells), m_matrices[i], grid_image
    raise GridNotFound("could not segment the grid into exactly 81 cells")


def decode_image(image_bytes: bytes) -> np.ndarray:
    """bytes -> BGR uint8 ndarray. Raises GridNotFound if it isn't a decodable image."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise GridNotFound("uploaded bytes are not a decodable image")
    return img


def extract_cells(image_bgr: np.ndarray) -> list[dict]:
    """BGR ndarray -> list of 81 cell dicts (row-major). Raises GridNotFound."""
    img = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    img = resize_and_maintain_aspect_ratio(img, RESIZE_WIDTH)
    cells, _M, _grid = get_valid_cells_from_image(img)
    return cells
