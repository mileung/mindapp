import { Link } from 'react-router-dom';
import { RecursiveTag } from '../utils/tags';

const RecTagLink = ({
	recTag,
	isRoot,
	onClick,
}: {
	recTag: RecursiveTag;
	isRoot?: boolean;
	onClick: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
	return (
		<div className="mt-0.5">
			{isRoot ? (
				<p className="text-fg1 px-2">{recTag.label}</p>
			) : (
				<Link
					className="rounded transition px-1.5 font-medium border-2 text-fg2 border-mg1 hover:text-fg1 hover:border-mg2"
					to={`/search?q=${encodeURIComponent(`[${recTag.label}]`)}`}
					onClick={onClick}
				>
					{recTag.label}
				</Link>
			)}
			<div className="pl-3 border-l-2 border-mg2">
				{isRoot && !recTag.subRecTags && <p className="text-fg2">No subtags</p>}
				{recTag.subRecTags?.map((subRecTag) => (
					<RecTagLink key={subRecTag.label} recTag={subRecTag} onClick={onClick} />
				))}
			</div>
		</div>
	);
};

export default RecTagLink;
