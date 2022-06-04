import React, { FC, useEffect, useState, useCallback } from 'react';

interface RelicItemProps {
    label?: string;
    handleClick: () => void;
}

export const RelicItem: FC<RelicItemProps> = (props) => {

    return (
        <button style={{
            width: "60px",
            height: "60px"
        }}
        onClick={props.handleClick}
        >
            {props.label}
        </button>
    );

}